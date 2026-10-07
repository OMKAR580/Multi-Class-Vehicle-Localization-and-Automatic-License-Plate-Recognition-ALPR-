package com.alpr.vehicle.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.alpr.vehicle.ui.screens.*

@Composable
fun SetupNavGraph(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        composable(route = Screen.Home.route) {
            HomeScreen(
                onNavigateToLogin = { navController.navigate(Screen.Login.route) },
                onNavigateToDashboard = { navController.navigate(Screen.Dashboard.route) }
            )
        }
        composable(route = Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = { navController.navigate(Screen.Dashboard.route) }
            )
        }
        composable(route = Screen.Dashboard.route) {
            DashboardScreen(
                onNavigateToDetect = { navController.navigate(Screen.Detect.route) },
                onNavigateToHistory = { navController.navigate(Screen.History.route) }
            )
        }
        composable(route = Screen.Detect.route) {
            DetectScreen()
        }
        composable(route = Screen.History.route) {
            HistoryScreen()
        }
        composable(route = Screen.Profile.route) {
            ProfileScreen()
        }
    }
}
