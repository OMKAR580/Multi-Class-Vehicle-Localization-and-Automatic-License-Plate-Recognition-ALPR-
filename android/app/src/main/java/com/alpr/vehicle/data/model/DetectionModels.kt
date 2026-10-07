package com.alpr.vehicle.data.model

import com.google.gson.annotations.SerializedName

data class LicensePlateResult(
    @SerializedName("text") val text: String,
    @SerializedName("confidence") val confidence: Float,
    @SerializedName("bbox") val bbox: List<Int>
)

data class VehicleResult(
    @SerializedName("type") val type: String,
    @SerializedName("confidence") val confidence: Float,
    @SerializedName("bbox") val bbox: List<Int>,
    @SerializedName("plate") val plate: LicensePlateResult?
)

data class AIDetectionResponse(
    @SerializedName("image_id") val imageId: String,
    @SerializedName("vehicles") val vehicles: List<VehicleResult>
)

data class DetectionJobResponse(
    @SerializedName("id") val id: String,
    @SerializedName("status") val status: String,
    @SerializedName("media_type") val mediaType: String,
    @SerializedName("media_url") val mediaUrl: String,
    @SerializedName("processing_time_ms") val processingTimeMs: Float?,
    @SerializedName("result") val result: AIDetectionResponse?
)

data class AuthTokenResponse(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("token_type") val tokenType: String,
    @SerializedName("refresh_token") val refreshToken: String
)
