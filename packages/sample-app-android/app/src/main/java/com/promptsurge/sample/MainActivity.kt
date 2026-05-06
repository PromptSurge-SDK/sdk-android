package com.promptsurge.sample

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.FragmentActivity
import com.google.android.material.button.MaterialButton
import com.promptsurge.sdk.PromptSurge

class MainActivity : FragmentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // M4: real API key issued for dev@promptsurge.test → "Sample App (M1)".
        // Re-issue via `pnpm --filter api db:seed-dev` (prints a fresh key).
        // M5+ will move this into a config screen / runtime input.
        PromptSurge.initialize(this, "ps_live_ZcZoUX01xY1AuMqtHK33hiL4XwnujF1l")

        findViewById<MaterialButton>(R.id.btnTriggerPrePrompt).setOnClickListener {
            PromptSurge.requestReview(this)
        }

        val resetBtn = findViewById<MaterialButton>(R.id.btnResetRateLimit)
        val overrideBtn = findViewById<MaterialButton>(R.id.btnOverrideLocale)
        if (BuildConfig.DEBUG) {
            resetBtn.visibility = View.VISIBLE
            resetBtn.setOnClickListener {
                PromptSurge.clearRateLimitForTesting()
                Toast.makeText(this, "Rate limit cleared", Toast.LENGTH_SHORT).show()
            }

            overrideBtn.visibility = View.VISIBLE
            overrideBtn.setOnClickListener { showLocalePicker() }
        }
    }

    private fun showLocalePicker() {
        val labels = arrayOf("Device default", "English (en)", "Deutsch (de)", "Español (es)", "Français (fr)", "日本語 (ja)")
        val codes = arrayOf<String?>(null, "en", "de", "es", "fr", "ja")
        AlertDialog.Builder(this)
            .setTitle("Override locale")
            .setItems(labels) { _, which ->
                PromptSurge.setLocaleOverride(codes[which])
                val msg = codes[which]?.let { "Locale set to $it" } ?: "Locale override cleared"
                Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
            }
            .show()
    }
}
