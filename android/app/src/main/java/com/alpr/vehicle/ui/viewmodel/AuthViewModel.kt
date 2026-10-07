package com.alpr.vehicle.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.alpr.vehicle.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    data class Success(val token: String) : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel(private val repository: AuthRepository) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState

    fun login(provider: String, code: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            val result = repository.loginWithOAuth(provider, code)
            result.onSuccess {
                _uiState.value = AuthUiState.Success(it.accessToken)
            }.onFailure {
                _uiState.value = AuthUiState.Error(it.message ?: "Authentication error")
            }
        }
    }
}
