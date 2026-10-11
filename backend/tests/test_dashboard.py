"""Unit, integration, edge-case, and authorization tests for Issue #10: Dashboard Statistics & Analytics API."""

import uuid
from datetime import datetime, timedelta, timezone
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models.detection import DetectionJob, Plate, Vehicle
from app.models.user import User
from app.repositories.user_repository import UserRepository

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_session():
    """Async session backed by an in-memory SQLite database."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
def client_with_db(db_session: AsyncSession):
    """TestClient overriding get_db dependency."""

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def user_a(db_session: AsyncSession) -> User:
    """Creates primary test user (User A)."""
    user_repo = UserRepository(db_session)
    user = User(
        email="usera@example.com",
        full_name="User A",
        hashed_password="hashed_pw_test",
    )
    return await user_repo.create(user)


@pytest_asyncio.fixture
async def user_b(db_session: AsyncSession) -> User:
    """Creates secondary test user (User B) for isolation testing."""
    user_repo = UserRepository(db_session)
    user = User(
        email="userb@example.com",
        full_name="User B",
        hashed_password="hashed_pw_test",
    )
    return await user_repo.create(user)


def auth_header(user: User) -> dict:
    """Generates valid Bearer Authorization header for user."""
    token = create_access_token(subject=str(user.id))
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. Dashboard Stats for Empty Dataset
# ==============================================================================


@pytest.mark.asyncio
async def test_dashboard_stats_empty_dataset(client_with_db: TestClient, user_a: User):
    """User with no recognition jobs should receive zeroed metrics and 0.0 success rate."""
    response = client_with_db.get("/api/v1/dashboard/stats", headers=auth_header(user_a))
    assert response.status_code == 200
    data = response.json()

    assert data["total_jobs"] == 0
    assert data["completed_jobs"] == 0
    assert data["failed_jobs"] == 0
    assert data["pending_jobs"] == 0
    assert data["processing_jobs"] == 0
    assert data["total_vehicles_detected"] == 0
    assert data["total_plates_detected"] == 0
    assert data["recognized_plates"] == 0
    assert data["image_jobs"] == 0
    assert data["video_jobs"] == 0
    assert data["success_rate"] == 0.0


@pytest.mark.asyncio
async def test_dashboard_activity_empty_dataset(client_with_db: TestClient, user_a: User):
    """User with no jobs should receive an empty activity list and total = 0."""
    response = client_with_db.get("/api/v1/dashboard/activity", headers=auth_header(user_a))
    assert response.status_code == 200
    data = response.json()

    assert data["items"] == []
    assert data["total"] == 0
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert data["total_pages"] == 0


# ==============================================================================
# 2. Correct Totals for Mixed Image and Video Jobs & Status Counts
# ==============================================================================


@pytest.mark.asyncio
async def test_dashboard_stats_mixed_jobs_and_statuses(
    client_with_db: TestClient, db_session: AsyncSession, user_a: User
):
    """Accurately tallies image/video jobs and status categories (completed, failed, pending, processing)."""
    now = datetime.now(timezone.utc)

    job1 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="COMPLETED",
        media_type="image",
        media_url="/uploads/img1.jpg",
        created_at=now - timedelta(minutes=10),
    )
    job2 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="FAILED",
        media_type="video",
        media_url="/uploads/vid1.mp4",
        error_message="Corrupted video frame at frame 23",
        created_at=now - timedelta(minutes=8),
    )
    job3 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="PENDING",
        media_type="image",
        media_url="/uploads/img2.jpg",
        created_at=now - timedelta(minutes=5),
    )
    job4 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="PROCESSING",
        media_type="video",
        media_url="/uploads/vid2.mp4",
        created_at=now - timedelta(minutes=2),
    )
    job5 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="COMPLETED",
        media_type="image",
        media_url="/uploads/img3.jpg",
        created_at=now - timedelta(minutes=1),
    )

    db_session.add_all([job1, job2, job3, job4, job5])
    await db_session.commit()

    response = client_with_db.get("/api/v1/dashboard/stats", headers=auth_header(user_a))
    assert response.status_code == 200
    data = response.json()

    assert data["total_jobs"] == 5
    assert data["completed_jobs"] == 2
    assert data["failed_jobs"] == 1
    assert data["pending_jobs"] == 1
    assert data["processing_jobs"] == 1
    assert data["image_jobs"] == 3
    assert data["video_jobs"] == 2
    # Terminal jobs = 2 completed + 1 failed = 3. Success rate = 2 / 3 * 100 = 66.67
    assert data["success_rate"] == 66.67


# ==============================================================================
# 3. Vehicle and Plate Counts Without Cartesian Inflation & Recognized Plate Text Rule
# ==============================================================================


@pytest.mark.asyncio
async def test_dashboard_stats_vehicle_plate_counts_no_inflation(
    client_with_db: TestClient, db_session: AsyncSession, user_a: User
):
    """
    Ensures vehicles and plates are aggregated correctly without multiplying counts:
    - Job 1: 2 Vehicles.
        - Vehicle 1 has Plate with valid text "KA01AB1234".
        - Vehicle 2 has Plate with empty text "  " (should NOT be counted in recognized_plates).
    - Job 2: 1 Vehicle.
        - Vehicle 3 has Plate with text "DL04CD5678".
    - Job 3: 1 Vehicle without plate.
    """
    now = datetime.now(timezone.utc)

    job1 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="COMPLETED",
        media_type="image",
        media_url="/uploads/job1.jpg",
        created_at=now - timedelta(minutes=10),
    )
    v1 = Vehicle(
        id=str(uuid.uuid4()),
        detection_job_id=job1.id,
        vehicle_type="car",
        confidence=0.95,
        bbox=[10, 10, 100, 100],
    )
    p1 = Plate(
        id=str(uuid.uuid4()),
        vehicle_id=v1.id,
        plate_text="KA01AB1234",
        confidence=0.92,
        bbox=[20, 20, 60, 40],
    )
    v2 = Vehicle(
        id=str(uuid.uuid4()),
        detection_job_id=job1.id,
        vehicle_type="truck",
        confidence=0.88,
        bbox=[110, 10, 200, 100],
    )
    p2 = Plate(
        id=str(uuid.uuid4()),
        vehicle_id=v2.id,
        plate_text="   ",  # whitespace only
        confidence=0.40,
        bbox=[120, 20, 160, 40],
    )

    job2 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="COMPLETED",
        media_type="video",
        media_url="/uploads/job2.mp4",
        created_at=now - timedelta(minutes=5),
    )
    v3 = Vehicle(
        id=str(uuid.uuid4()),
        detection_job_id=job2.id,
        vehicle_type="motorcycle",
        confidence=0.91,
        bbox=[30, 30, 80, 80],
    )
    p3 = Plate(
        id=str(uuid.uuid4()),
        vehicle_id=v3.id,
        plate_text="DL04CD5678",
        confidence=0.89,
        bbox=[35, 40, 65, 55],
    )

    job3 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="COMPLETED",
        media_type="image",
        media_url="/uploads/job3.jpg",
        created_at=now - timedelta(minutes=2),
    )
    v4 = Vehicle(
        id=str(uuid.uuid4()),
        detection_job_id=job3.id,
        vehicle_type="bus",
        confidence=0.85,
        bbox=[5, 5, 250, 150],
    )

    db_session.add_all([job1, v1, p1, v2, p2, job2, v3, p3, job3, v4])
    await db_session.commit()

    response = client_with_db.get("/api/v1/dashboard/stats", headers=auth_header(user_a))
    assert response.status_code == 200
    data = response.json()

    assert data["total_jobs"] == 3
    assert data["total_vehicles_detected"] == 4  # v1, v2, v3, v4
    assert data["total_plates_detected"] == 3    # p1, p2, p3
    assert data["recognized_plates"] == 2        # p1 ("KA01AB1234"), p3 ("DL04CD5678")
    assert data["success_rate"] == 100.0


# ==============================================================================
# 4. Success Rate Edge Cases
# ==============================================================================


@pytest.mark.asyncio
async def test_dashboard_success_rate_zero_terminal_jobs(
    client_with_db: TestClient, db_session: AsyncSession, user_a: User
):
    """When only PENDING or PROCESSING jobs exist, terminal jobs == 0 -> success_rate is 0.0."""
    job1 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="PENDING",
        media_type="image",
        media_url="/uploads/pending.jpg",
    )
    job2 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="PROCESSING",
        media_type="video",
        media_url="/uploads/proc.mp4",
    )
    db_session.add_all([job1, job2])
    await db_session.commit()

    response = client_with_db.get("/api/v1/dashboard/stats", headers=auth_header(user_a))
    assert response.status_code == 200
    data = response.json()

    assert data["total_jobs"] == 2
    assert data["completed_jobs"] == 0
    assert data["failed_jobs"] == 0
    assert data["pending_jobs"] == 1
    assert data["processing_jobs"] == 1
    assert data["success_rate"] == 0.0


@pytest.mark.asyncio
async def test_dashboard_success_rate_all_failed(
    client_with_db: TestClient, db_session: AsyncSession, user_a: User
):
    """When only FAILED jobs exist, success_rate is 0.0."""
    job1 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="FAILED",
        media_type="image",
        media_url="/uploads/fail.jpg",
        error_message="Image unreadable",
    )
    db_session.add(job1)
    await db_session.commit()

    response = client_with_db.get("/api/v1/dashboard/stats", headers=auth_header(user_a))
    assert response.status_code == 200
    data = response.json()

    assert data["total_jobs"] == 1
    assert data["failed_jobs"] == 1
    assert data["completed_jobs"] == 0
    assert data["success_rate"] == 0.0


# ==============================================================================
# 5. User Isolation — Stats & Activity
# ==============================================================================


@pytest.mark.asyncio
async def test_dashboard_user_isolation(
    client_with_db: TestClient, db_session: AsyncSession, user_a: User, user_b: User
):
    """User A and User B cannot see each other's statistics or recent activity items."""
    # User A job
    job_a = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="COMPLETED",
        media_type="image",
        media_url="/uploads/a.jpg",
    )
    v_a = Vehicle(
        id=str(uuid.uuid4()),
        detection_job_id=job_a.id,
        vehicle_type="car",
        confidence=0.9,
        bbox=[0, 0, 10, 10],
    )
    p_a = Plate(
        id=str(uuid.uuid4()),
        vehicle_id=v_a.id,
        plate_text="USERAPLATE",
        confidence=0.95,
        bbox=[1, 1, 5, 5],
    )

    # User B jobs (2 jobs, 3 vehicles, 2 plates)
    job_b1 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_b.id),
        status="COMPLETED",
        media_type="video",
        media_url="/uploads/b1.mp4",
    )
    job_b2 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_b.id),
        status="FAILED",
        media_type="video",
        media_url="/uploads/b2.mp4",
        error_message="User B error",
    )

    db_session.add_all([job_a, v_a, p_a, job_b1, job_b2])
    await db_session.commit()

    # Query User A stats
    res_a_stats = client_with_db.get("/api/v1/dashboard/stats", headers=auth_header(user_a))
    assert res_a_stats.status_code == 200
    data_a = res_a_stats.json()
    assert data_a["total_jobs"] == 1
    assert data_a["total_vehicles_detected"] == 1
    assert data_a["recognized_plates"] == 1
    assert data_a["image_jobs"] == 1
    assert data_a["video_jobs"] == 0

    # Query User B stats
    res_b_stats = client_with_db.get("/api/v1/dashboard/stats", headers=auth_header(user_b))
    assert res_b_stats.status_code == 200
    data_b = res_b_stats.json()
    assert data_b["total_jobs"] == 2
    assert data_b["completed_jobs"] == 1
    assert data_b["failed_jobs"] == 1
    assert data_b["image_jobs"] == 0
    assert data_b["video_jobs"] == 2
    assert data_b["success_rate"] == 50.0

    # Query User A activity
    res_a_act = client_with_db.get("/api/v1/dashboard/activity", headers=auth_header(user_a))
    assert res_a_act.status_code == 200
    data_act_a = res_a_act.json()
    assert data_act_a["total"] == 1
    assert data_act_a["items"][0]["job_id"] == job_a.id
    assert data_act_a["items"][0]["vehicle_count"] == 1
    assert data_act_a["items"][0]["recognized_plate_count"] == 1

    # Query User B activity
    res_b_act = client_with_db.get("/api/v1/dashboard/activity", headers=auth_header(user_b))
    assert res_b_act.status_code == 200
    data_act_b = res_b_act.json()
    assert data_act_b["total"] == 2
    b_ids = {item["job_id"] for item in data_act_b["items"]}
    assert b_ids == {job_b1.id, job_b2.id}
    assert job_a.id not in b_ids


# ==============================================================================
# 6. Activity Pagination and Deterministic Ordering
# ==============================================================================


@pytest.mark.asyncio
async def test_dashboard_activity_pagination_and_ordering(
    client_with_db: TestClient, db_session: AsyncSession, user_a: User
):
    """Tests 1-indexed pagination and deterministic created_at DESC, id DESC ordering."""
    base_time = datetime.now(timezone.utc) - timedelta(hours=1)
    jobs = []

    for i in range(5):
        job = DetectionJob(
            id=f"00000000-0000-0000-0000-00000000000{i}",
            user_id=str(user_a.id),
            status="COMPLETED",
            media_type="image",
            media_url=f"/uploads/img_{i}.jpg",
            created_at=base_time + timedelta(minutes=i * 5),
        )
        jobs.append(job)

    db_session.add_all(jobs)
    await db_session.commit()

    # Page 1, page_size 2 -> should return job 4 and job 3 (newest first)
    res_p1 = client_with_db.get(
        "/api/v1/dashboard/activity?page=1&page_size=2", headers=auth_header(user_a)
    )
    assert res_p1.status_code == 200
    p1_data = res_p1.json()
    assert p1_data["total"] == 5
    assert p1_data["page"] == 1
    assert p1_data["page_size"] == 2
    assert p1_data["total_pages"] == 3
    assert len(p1_data["items"]) == 2
    assert p1_data["items"][0]["job_id"] == jobs[4].id
    assert p1_data["items"][1]["job_id"] == jobs[3].id

    # Page 2, page_size 2 -> should return job 2 and job 1
    res_p2 = client_with_db.get(
        "/api/v1/dashboard/activity?page=2&page_size=2", headers=auth_header(user_a)
    )
    assert res_p2.status_code == 200
    p2_data = res_p2.json()
    assert len(p2_data["items"]) == 2
    assert p2_data["items"][0]["job_id"] == jobs[2].id
    assert p2_data["items"][1]["job_id"] == jobs[1].id

    # Page 3, page_size 2 -> should return job 0
    res_p3 = client_with_db.get(
        "/api/v1/dashboard/activity?page=3&page_size=2", headers=auth_header(user_a)
    )
    assert res_p3.status_code == 200
    p3_data = res_p3.json()
    assert len(p3_data["items"]) == 1
    assert p3_data["items"][0]["job_id"] == jobs[0].id


# ==============================================================================
# 7. Date Filtering, Range Boundaries, and Invalid / Reversed Range Validation
# ==============================================================================


@pytest.mark.asyncio
async def test_dashboard_date_filtering(
    client_with_db: TestClient, db_session: AsyncSession, user_a: User
):
    """Filters statistics and activity correctly based on start_date and end_date."""
    t0 = datetime(2026, 1, 10, 10, 0, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 1, 20, 10, 0, 0, tzinfo=timezone.utc)

    job1 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="COMPLETED",
        media_type="image",
        media_url="/uploads/t0.jpg",
        created_at=t0,
    )
    job2 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="COMPLETED",
        media_type="image",
        media_url="/uploads/t1.jpg",
        created_at=t1,
    )
    job3 = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="COMPLETED",
        media_type="image",
        media_url="/uploads/t2.jpg",
        created_at=t2,
    )

    db_session.add_all([job1, job2, job3])
    await db_session.commit()

    # Filter including only t1 (2026-01-12 to 2026-01-18)
    params = {
        "start_date": "2026-01-12T00:00:00Z",
        "end_date": "2026-01-18T00:00:00Z",
    }
    res_stats = client_with_db.get(
        "/api/v1/dashboard/stats", params=params, headers=auth_header(user_a)
    )
    assert res_stats.status_code == 200
    assert res_stats.json()["total_jobs"] == 1

    res_act = client_with_db.get(
        "/api/v1/dashboard/activity", params=params, headers=auth_header(user_a)
    )
    assert res_act.status_code == 200
    act_data = res_act.json()
    assert act_data["total"] == 1
    assert act_data["items"][0]["job_id"] == job2.id

    # Test start_date alone (>= 2026-01-15: should match job2 and job3)
    res_start_only = client_with_db.get(
        "/api/v1/dashboard/stats",
        params={"start_date": "2026-01-15T00:00:00Z"},
        headers=auth_header(user_a),
    )
    assert res_start_only.status_code == 200
    assert res_start_only.json()["total_jobs"] == 2

    # Test end_date alone (<= 2026-01-15 12:00:00: should match job1 and job2)
    res_end_only = client_with_db.get(
        "/api/v1/dashboard/stats",
        params={"end_date": "2026-01-15T12:00:00Z"},
        headers=auth_header(user_a),
    )
    assert res_end_only.status_code == 200
    assert res_end_only.json()["total_jobs"] == 2


@pytest.mark.asyncio
async def test_dashboard_date_validation_reversed_range(
    client_with_db: TestClient, user_a: User
):
    """Reversed date range (start_date > end_date) must return HTTP 422."""
    params = {
        "start_date": "2026-01-20T00:00:00Z",
        "end_date": "2026-01-10T00:00:00Z",
    }
    # Test on stats endpoint
    res_stats = client_with_db.get(
        "/api/v1/dashboard/stats", params=params, headers=auth_header(user_a)
    )
    assert res_stats.status_code == 422
    assert "start_date cannot be after end_date" in res_stats.json()["detail"]

    # Test on activity endpoint
    res_act = client_with_db.get(
        "/api/v1/dashboard/activity", params=params, headers=auth_header(user_a)
    )
    assert res_act.status_code == 422
    assert "start_date cannot be after end_date" in res_act.json()["detail"]


@pytest.mark.asyncio
async def test_dashboard_date_validation_invalid_format(
    client_with_db: TestClient, user_a: User
):
    """Invalid date format string must be rejected with HTTP 422 by FastAPI query validation."""
    params = {"start_date": "not-a-valid-date"}
    res = client_with_db.get(
        "/api/v1/dashboard/stats", params=params, headers=auth_header(user_a)
    )
    assert res.status_code == 422


# ==============================================================================
# 8. Unauthenticated Access Rejection
# ==============================================================================


def test_dashboard_stats_unauthenticated(client_with_db: TestClient):
    """Accessing /dashboard/stats without token returns HTTP 401."""
    res = client_with_db.get("/api/v1/dashboard/stats")
    assert res.status_code == 401


def test_dashboard_activity_unauthenticated(client_with_db: TestClient):
    """Accessing /dashboard/activity without token returns HTTP 401."""
    res = client_with_db.get("/api/v1/dashboard/activity")
    assert res.status_code == 401


# ==============================================================================
# 9. Failed Jobs and Error Message Exposure
# ==============================================================================


@pytest.mark.asyncio
async def test_dashboard_activity_failed_job_safe_error(
    client_with_db: TestClient, db_session: AsyncSession, user_a: User
):
    """Failed jobs safely display their error_message without breaking schema contract."""
    failed_job = DetectionJob(
        id=str(uuid.uuid4()),
        user_id=str(user_a.id),
        status="FAILED",
        media_type="image",
        media_url="/uploads/corrupt.jpg",
        error_message="Unsupported image encoding",
    )
    db_session.add(failed_job)
    await db_session.commit()

    res = client_with_db.get("/api/v1/dashboard/activity", headers=auth_header(user_a))
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["status"] == "FAILED"
    assert item["error_message"] == "Unsupported image encoding"
    assert item["vehicle_count"] == 0
    assert item["recognized_plate_count"] == 0
