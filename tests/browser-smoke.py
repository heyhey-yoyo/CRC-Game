#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
STANDALONE = ROOT / "dist" / "standalone-demo.html"


def open_standalone(page):
    page.set_content(STANDALONE.read_text(encoding="utf-8"), wait_until="load")
    page.wait_for_selector("#landing:not(.is-hidden)")


def run():
    errors = []
    with sync_playwright() as p:
        launch_args = {"headless": True, "args": ["--no-sandbox"]}
        if Path("/usr/bin/chromium").exists():
            launch_args["executable_path"] = "/usr/bin/chromium"
        browser = p.chromium.launch(**launch_args)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: errors.append(f"console: {msg.text}") if msg.type == "error" else None)
        open_standalone(page)
        root_font = float(page.evaluate("parseFloat(getComputedStyle(document.documentElement).fontSize)"))
        assert root_font >= 18, root_font
        page.click("#newCaseButton")
        page.wait_for_selector("#appShell:not(.is-hidden)")

        positions = page.evaluate("""() => [...document.querySelectorAll('.command-grid > .panel')].slice(0,6).map(x => ({top: Math.round(x.getBoundingClientRect().top), left: Math.round(x.getBoundingClientRect().left)}))""")
        assert abs(positions[0]["top"] - positions[1]["top"]) <= 4, positions
        assert abs(positions[2]["top"] - positions[3]["top"]) <= 4, positions
        assert abs(positions[4]["top"] - positions[5]["top"]) <= 4, positions
        assert positions[0]["left"] < positions[1]["left"], positions

        page.click("#advanceButton")
        page.wait_for_selector("#eventDialog[open]")
        assert "研究性证据返回" in page.locator("#eventDialogTitle").inner_text()
        page.locator("#eventDialog .button.primary").click()
        page.locator('[data-hypothesis="selection"]').click()

        for expected in ["安全复核", "继续治疗前复核"]:
            page.click("#advanceButton")
            page.wait_for_selector("#eventDialog[open]")
            assert expected in page.locator("#eventDialogTitle").inner_text()
            page.locator("#eventDialog .button.primary").click()

        page.click("#advanceButton")
        page.wait_for_selector("#recapDialog[open]", timeout=15000)
        assert page.locator("#recapGrid .recap-card").count() == 4
        page.locator('#recapDialog button[value="compare"]').click()
        page.wait_for_selector("#view-compare.is-active")
        page.wait_for_selector("#compareBoard:not(.is-hidden)")
        assert page.locator("#compareBoard .compare-card").count() == 3

        before = float(page.evaluate("parseFloat(getComputedStyle(document.body).fontSize)"))
        page.click("#textScaleButton")
        after = float(page.evaluate("parseFloat(getComputedStyle(document.body).fontSize)"))
        assert after > before, (before, after)

        page.click("#saveButton")
        page.wait_for_selector("#saveDialog[open]")
        page.click("#manualSaveButton")
        page.wait_for_timeout(250)
        assert page.locator("#saveList .save-record").count() >= 1
        page.locator('#saveDialog button[value="close"]').last.click()

        mobile_context = browser.new_context(viewport={"width": 390, "height": 844})
        mobile = mobile_context.new_page()
        open_standalone(mobile)
        overflow = mobile.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        assert overflow <= 1, overflow
        mobile_context.close()
        context.close()
        browser.close()

    assert not errors, "\n".join(errors)
    print("Browser smoke test passed: desktop flow, row-major layout, W0→W8, compare, save, text scaling, mobile overflow.")

if __name__ == "__main__":
    run()
