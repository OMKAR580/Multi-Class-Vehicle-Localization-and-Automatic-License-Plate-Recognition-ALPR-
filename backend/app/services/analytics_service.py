"""Service layer orchestrating multi-parametric analytics aggregation and telemetry."""

from datetime import datetime, timedelta, timezone
import re
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidFileException
from app.models.user import User
from app.repositories.analytics_repository import AnalyticsRepository
from app.schemas.analytics import (
    AnalyticsHourlyBucket,
    AnalyticsJurisdiction,
    AnalyticsMediaBreakdown,
    AnalyticsOverviewResponse,
    AnalyticsPerformance,
    AnalyticsPeriod,
    AnalyticsPlateMetrics,
    AnalyticsSummary,
    AnalyticsTimeDistribution,
    AnalyticsTimelinePoint,
    AnalyticsVehicleClass,
    AnalyticsWeekdayBucket,
)

INDIAN_STATE_CODES: Dict[str, str] = {
    "DL": "Delhi NCT",
    "UP": "Uttar Pradesh",
    "HR": "Haryana",
    "MH": "Maharashtra",
    "KA": "Karnataka",
    "RJ": "Rajasthan",
    "TN": "Tamil Nadu",
    "GJ": "Gujarat",
    "WB": "West Bengal",
    "PB": "Punjab",
    "TS": "Telangana",
    "AP": "Andhra Pradesh",
    "MP": "Madhya Pradesh",
    "KL": "Kerala",
    "CH": "Chandigarh",
    "UK": "Uttarakhand",
    "UA": "Uttarakhand",
    "BR": "Bihar",
    "GA": "Goa",
    "JK": "Jammu & Kashmir",
    "HP": "Himachal Pradesh",
    "OD": "Odisha",
    "OR": "Odisha",
    "AS": "Assam",
    "JH": "Jharkhand",
    "CT": "Chhattisgarh",
    "CG": "Chhattisgarh",
}


class AnalyticsService:
    """Service providing unified analytics aggregation and jurisdiction extraction."""

    def __init__(self, db: AsyncSession):
        self.repo = AnalyticsRepository(session=db)

    def _extract_jurisdictions(self, plate_strings: List[str]) -> List[AnalyticsJurisdiction]:
        """Extracts and groups 2-letter state code jurisdictions from actual recognized plate strings."""
        if not plate_strings:
            return []

        counts: Dict[str, int] = {}
        for text in plate_strings:
            # Clean non-alphanumeric
            clean = re.sub(r"[^A-Za-z0-9]", "", text).upper()
            if len(clean) >= 2 and clean[:2].isalpha():
                code = clean[:2]
                counts[code] = counts.get(code, 0) + 1
            else:
                counts["OTHER"] = counts.get("OTHER", 0) + 1

        total_rec = len(plate_strings)
        jurisdictions: List[AnalyticsJurisdiction] = []

        # Sort descending by count
        sorted_codes = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        for code, count in sorted_codes[:8]:
            name = INDIAN_STATE_CODES.get(code, "Other States / UTs" if code == "OTHER" else f"{code} Jurisdiction")
            share = round((count / total_rec) * 100.0, 1) if total_rec > 0 else 0.0
            jurisdictions.append(
                AnalyticsJurisdiction(
                    code=code,
                    name=name,
                    count=count,
                    share=share,
                )
            )

        return jurisdictions

    async def get_analytics_overview(
        self,
        current_user: User,
        days: Optional[int] = 30,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        media_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> AnalyticsOverviewResponse:
        """
        Calculates complete traffic & recognition intelligence for the authenticated user.
        """
        now = datetime.now(timezone.utc)

        # Resolve date boundaries
        if start_date is not None and end_date is not None:
            if start_date > end_date:
                raise InvalidFileException("start_date cannot be greater than end_date.")
            period_days = (end_date - start_date).days
        elif start_date is not None:
            end_date = now
            if start_date > end_date:
                raise InvalidFileException("start_date cannot be in the future.")
            period_days = (end_date - start_date).days
        elif end_date is not None:
            day_span = days if days and days > 0 else 30
            start_date = end_date - timedelta(days=day_span)
            period_days = day_span
        else:
            day_span = days if days and days > 0 else 30
            end_date = now
            start_date = now - timedelta(days=day_span)
            period_days = day_span

        # 1. Headline summary KPIs
        summary_data = await self.repo.get_analytics_summary(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            media_type=media_type,
            status=status,
        )
        summary = AnalyticsSummary(**summary_data)

        # 2. Activity Timeline
        timeline_data = await self.repo.get_activity_timeline(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            media_type=media_type,
            status=status,
        )
        activity_timeline = [AnalyticsTimelinePoint(**p) for p in timeline_data]

        # 3. Vehicle Class Breakdown
        vehicle_data = await self.repo.get_vehicle_distribution(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            media_type=media_type,
            status=status,
        )
        vehicle_distribution = [AnalyticsVehicleClass(**v) for v in vehicle_data]

        # 4. License Plate Analytics
        plate_strings = await self.repo.get_recognized_plate_strings(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            media_type=media_type,
            status=status,
        )
        jurisdictions = self._extract_jurisdictions(plate_strings)
        rec_rate = (
            round((summary.recognized_plates / summary.total_plates) * 100.0, 1)
            if summary.total_plates > 0
            else None
        )
        plate_analytics = AnalyticsPlateMetrics(
            total_detected=summary.total_plates,
            recognized=summary.recognized_plates,
            unreadable=summary.unreadable_plates,
            recognition_rate=rec_rate,
            top_jurisdictions=jurisdictions,
        )

        # 5. Media Breakdown (Image vs Video)
        media_data = await self.repo.get_media_breakdown(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            status=status,
        )
        media_breakdown = AnalyticsMediaBreakdown(**media_data)

        # 6. Operational Performance
        perf_data = await self.repo.get_performance_metrics(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            media_type=media_type,
        )
        performance = AnalyticsPerformance(**perf_data)

        # 7. Time Distribution (Hourly and Weekday)
        time_data = await self.repo.get_time_distribution(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            media_type=media_type,
            status=status,
        )
        time_distribution = AnalyticsTimeDistribution(
            hourly=[AnalyticsHourlyBucket(**h) for h in time_data["hourly"]],
            weekday=[AnalyticsWeekdayBucket(**w) for w in time_data["weekday"]],
        )

        return AnalyticsOverviewResponse(
            period=AnalyticsPeriod(
                start_date=start_date,
                end_date=end_date,
                days=period_days,
                timezone="UTC",
            ),
            summary=summary,
            activity_timeline=activity_timeline,
            vehicle_distribution=vehicle_distribution,
            plate_analytics=plate_analytics,
            media_breakdown=media_breakdown,
            performance=performance,
            time_distribution=time_distribution,
            generated_at=now,
        )

