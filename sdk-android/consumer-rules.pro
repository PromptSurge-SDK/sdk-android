# Consumer rules for apps that depend on this library.
#
# These ship inside the AAR and are applied automatically to the host app's R8 run. Verified by
# building the sample app with isMinifyEnabled = true (see sample-app-android/app/build.gradle.kts)
# rather than reasoned about: every real host ships minified, and this SDK had never been through
# R8 at all.

# --- Public API -------------------------------------------------------------------------------
# Kept by name so that an integrator's own reflection, a Kotlin object lookup, or a stack trace
# from the field still names the entry point. It is a handful of methods, so the cost is nil.
-keep public class com.promptsurge.sdk.PromptSurge { public *; }
-keep public enum com.promptsurge.sdk.PromptSurge$LogLevel { *; }

# --- Fragment reconstruction ------------------------------------------------------------------
# The FragmentManager re-instantiates a DialogFragment reflectively through its no-arg constructor
# after a configuration change or process death. R8 sees no caller for that constructor and would
# strip it, which surfaces as a crash on rotation only in minified builds.
-keepclassmembers class com.promptsurge.sdk.PrePromptDialogFragment {
    <init>();
}

# --- kotlinx.serialization --------------------------------------------------------------------
# The runtime ships its own rules, but they do not cover generated serializers on classes the host
# never references by name. Ours are internal and reached only via `X.serializer()`, which R8 can
# fail to trace through the synthetic Companion.
-keepclassmembers class com.promptsurge.sdk.internal.** {
    *** Companion;
}
-keepclasseswithmembers class com.promptsurge.sdk.internal.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.promptsurge.sdk.internal.**$$serializer { *; }
