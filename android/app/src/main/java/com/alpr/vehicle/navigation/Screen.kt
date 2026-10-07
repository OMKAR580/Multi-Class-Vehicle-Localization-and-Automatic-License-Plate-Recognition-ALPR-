package com.alpr.vehicle.navigation

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object Detect : Screen("detect")
    object History : Screen("history")
    object Profile : Screen("profile")
}
