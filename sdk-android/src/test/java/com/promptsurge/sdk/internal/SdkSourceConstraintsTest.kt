package com.promptsurge.sdk.internal

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * Source-level guards for two things that compile and test green but break on a user's device.
 *
 * Both were real: `java.time.Instant` in [Telemetry] crashed every host app on launch on the
 * SDK's own declared minimum OS, and raw `android.util.Log` calls shipped a release build that
 * logged on the happy path (including four characters of the API key).
 */
class SdkSourceConstraintsTest {

    private val mainSources: List<File> by lazy {
        val root = File("src/main/java/com/promptsurge/sdk")
        check(root.isDirectory) { "expected SDK sources at ${root.absolutePath}" }
        root.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
    }

    /** Source with comment lines dropped, so a rule can be explained without tripping itself. */
    private fun File.code(): String = readLines()
        .filterNot { val t = it.trim(); t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") }
        .joinToString("\n")

    @Test
    fun `no java time usage anywhere in the SDK`() {
        // java.time is API 26+; the SDK is minSdk 24 with core-library desugaring off. Enabling
        // desugaring would push the requirement onto every host app instead, so the rule is
        // simply: do not use it.
        val offenders = mainSources.filter { it.code().contains("java.time") }
        assertEquals("java.time is API 26+, minSdk is 24", emptyList<String>(), offenders.map { it.name })
    }

    @Test
    fun `all logging goes through PsLog`() {
        val offenders = mainSources
            .filterNot { it.name == "PsLog.kt" }
            .filter { Regex("""(^|[^s])Log\.[dwiev]\(""").containsMatchIn(it.code()) }
        assertEquals(
            "use PsLog so release builds stay quiet and never log the API key",
            emptyList<String>(),
            offenders.map { it.name },
        )
    }

    @Test
    fun `the API key is never logged`() {
        val offenders = mainSources.filter {
            Regex("""(PsLog|Log)\.[dwiev]\([^)]*apiKey""").containsMatchIn(it.code())
        }
        assertEquals(emptyList<String>(), offenders.map { it.name })
    }
}
