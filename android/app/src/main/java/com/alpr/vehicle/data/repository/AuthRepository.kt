package com.alpr.vehicle.data.repository

import com.alpr.vehicle.data.model.AuthTokenResponse
import com.alpr.vehicle.data.network.ApiService

class AuthRepository(private val apiService: ApiService) {

    suspend fun loginWithOAuth(provider: String, code: String): Result<AuthTokenResponse> {
        return try {
            val response = apiService.login(mapOf("provider" to provider, "code" to code))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("OAuth Authentication Failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
