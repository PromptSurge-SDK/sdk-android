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

// The sample app lives outside this directory in the monorepo, so it does not survive the
// `git subtree split` that produces the public PromptSurge-SDK/sdk-android mirror. Including it
// unconditionally made Gradle configuration fail on the mirror - which is where JitPack builds
// from, so the published artifact could never have built at all.
val sampleApp = file("../sample-app-android/app")
if (sampleApp.isDirectory) {
    include(":sample-app-android")
    project(":sample-app-android").projectDir = sampleApp
}
