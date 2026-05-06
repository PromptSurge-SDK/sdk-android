pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "promptsurge-android"
include(":sdk-android")
include(":sample-app-android")

project(":sample-app-android").projectDir = file("../sample-app-android/app")
