package com.alpr.vehicle.data.network

import com.alpr.vehicle.data.model.AuthTokenResponse
import com.alpr.vehicle.data.model.DetectionJobResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {

    @GET("health")
    suspend fun checkHealth(): Response<Map<String, String>>

    @POST("auth/login")
    suspend fun login(@Body body: Map<String, String>): Response<AuthTokenResponse>

    @POST("detection/process")
    suspend fun processDetection(@Body body: Map<String, String>): Response<DetectionJobResponse>

    @GET("detection/job/{id}")
    suspend fun getJobStatus(@Path("id") jobId: String): Response<DetectionJobResponse>
}
