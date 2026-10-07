package com.alpr.vehicle.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alpr.vehicle.data.model.DetectionJobResponse
import com.alpr.vehicle.data.repository.DetectionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class DetectionUiState {
    object Idle : DetectionUiState()
    object Processing : DetectionUiState()
    data class Success(val job: DetectionJobResponse) : DetectionUiState()
    data class Error(val message: String) : DetectionUiState()
}

class DetectionViewModel(private val repository: DetectionRepository) : ViewModel() {

    private val _uiState = MutableStateFlow<DetectionUiState>(DetectionUiState.Idle)
    val uiState: StateFlow<DetectionUiState> = _uiState

    fun runDetection(mediaUrl: String, mediaType: String = "image") {
        viewModelScope.launch {
            _uiState.value = DetectionUiState.Processing
            val result = repository.submitDetection(mediaUrl, mediaType)
            result.onSuccess {
                _uiState.value = DetectionUiState.Success(it)
            }.onFailure {
                _uiState.value = DetectionUiState.Error(it.message ?: "Detection failed")
            }
        }
    }
}
