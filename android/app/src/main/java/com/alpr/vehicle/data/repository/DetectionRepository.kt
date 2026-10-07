package com.alpr.vehicle.data.repository

import com.alpr.vehicle.data.model.DetectionJobResponse
import com.alpr.vehicle.data.network.ApiService

class DetectionRepository(private val apiService: ApiService) {

    suspend fun submitDetection(mediaUrl: String, mediaType: String): Result<DetectionJobResponse> {
        return try {
            val response = apiService.processDetection(mapOf("media_url" to mediaUrl, "media_type" to mediaType))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Detection submission failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
