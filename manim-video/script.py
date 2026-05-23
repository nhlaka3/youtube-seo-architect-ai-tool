"""
YT SEO Architect — explainer video (Manim CE)
Runs locally: /tmp/venv/bin/python manim-video.py -ql SceneName
Stitches all scenes → final.mp4 via concat.txt + ffmpeg
"""

from manim import *
import os

# ── Palette ──────────────────────────────────────────────────────────────────
BG        = "#0A0A0A"
PRIMARY   = "#00F5FF"   # cyan — headline / callout
SECONDARY = "#7B61FF"   # purple — sub-brand
ACCENT    = "#39FF14"   # neon green — good scores / success
WARN_RED  = "#FF3366"   # red — problem / attention
MUTED     = "#666666"
TEXT      = "#EAEAEA"
MONO      = "Menlo"

# ── Helpers ──────────────────────────────────────────────────────────────────

def make_full_scene_bg(mobj):
    """Fade to black at the end, clearing all mobjects."""
    return FadeOut(Group(*mobj), run_time=0.5)


# ============================================================================
# SCENE 1 — Opening Title
# ============================================================================
class Scene1_Opening(Scene):
    def construct(self):
        self.camera.background_color = BG

        line1 = Text("YT SEO", font_size=72, font=MONO, weight=BOLD, color=PRIMARY)
        line2 = Text("Architect", font_size=72, font=MONO, weight=BOLD, color=SECONDARY)

        subtitle = Text("AI-Powered YouTube SEO Toolkit",
                        font_size=28, font=MONO, color=MUTED)
        tagline = Text("17 tools. 100 free credits. No credit card.",
                       font_size=22, font=MONO, color=TEXT)

        line2.next_to(line1, DOWN, buff=0.1)
        title_group = VGroup(line1, line2).move_to(UP * 0.5)
        subtitle.next_to(title_group, DOWN, buff=0.6)
        tagline.next_to(subtitle, DOWN, buff=0.3)

        self.add_subcaption("YT SEO Architect — AI-powered YouTube SEO toolkit", duration=2)

        self.play(Write(line1), run_time=1.2)
        self.wait(0.3)
        self.play(Write(line2), run_time=1.2)
        self.wait(0.8)
        self.play(FadeIn(subtitle, lag_ratio=0.3), run_time=1.0)
        self.play(FadeIn(tagline), run_time=0.8)
        self.wait(2.0)

        self.play(make_full_scene_bg([line1, line2, subtitle, tagline]),
                  run_time=0.5)
        self.wait(0.2)


# ============================================================================
# SCENE 2 — The Problem
# ============================================================================
class Scene2_Problem(Scene):
    def construct(self):
        self.camera.background_color = BG

        heading = Text("SEO by hand is a drag.", font_size=40, font=MONO,
                       weight=BOLD, color=WARN_RED)
        self.add_subcaption("Researching keywords, writing descriptions, optimizing tags — it takes hours", duration=3)

        tasks = [
            "Keyword research  ████████░░  4+ hrs",
            "Title testing      ██████░░░░  3 hrs",
            "Tag research       ███████░░░  3 hrs",
            "Description write  ██████░░░░  2 hrs",
            "Thumbnail tweaks   ████░░░░░░  2 hrs",
        ]
        bar_group = VGroup()
        for i, row in enumerate(tasks):
            color = WARN_RED if i < 3 else MUTED
            bar = Text(row, font_size=22, color=color, font=MONO)  # font once
            bar.shift(UP * (1.5 - i * 0.65))
            bar_group.add(bar)

        total_label = Text("= 14+ hours per video",
                           font_size=26, font=MONO, weight=BOLD, color=WARN_RED)
        total_label.next_to(bar_group, DOWN, buff=0.7)

        self.play(Write(heading), run_time=1.0)
        self.wait(1.0)

        for i, bar in enumerate(bar_group):
            self.play(FadeIn(bar, run_time=0.45))
            self.wait(0.15)

        self.play(FadeIn(total_label), run_time=0.8)
        self.wait(2.0)

        self.play(make_full_scene_bg([heading] + list(bar_group) + [total_label]),
                  run_time=0.5)
        self.wait(0.2)


# ============================================================================
# SCENE 3 — What It Is
# ============================================================================
class Scene3_Dashboard(Scene):
    def construct(self):
        self.camera.background_color = BG

        self.add_subcaption("The dashboard brings all 17 tools into one place", duration=3)

        # Central label
        center_dot = Dot(radius=0.12, color=PRIMARY)
        center_lbl = Text("Dashboard", font_size=22, font=MONO, color=PRIMARY)
        center_lbl.next_to(center_dot, DOWN, buff=0.15)
        core = VGroup(center_dot, center_lbl).move_to(ORIGIN)

        self.play(Create(center_dot), run_time=0.6)
        self.wait(0.3)
        self.play(FadeIn(center_lbl), run_time=0.5)

        tools = [
            ("Keyword\nDiscovery", UP * 2.2 + LEFT * 2.0),
            ("SEO\nAudit", UP * 2.2 + RIGHT * 2.0),
            ("Script\nGenerator", UP * 0.6 + LEFT * 2.5),
            ("Tag\nGenerator", UP * 0.6 + RIGHT * 2.5),
            ("Thumbnail\nLab", DOWN * 1.0 + LEFT * 2.0),
            ("AI\nCoach", DOWN * 1.0 + RIGHT * 2.0),
            ("Analytics", DOWN * 2.2),
        ]

        tool_dots = VGroup()
        tool_labels = VGroup()
        for name, pos in tools:
            d = Dot(radius=0.1, color=SECONDARY)
            d.move_to(pos)
            lbl = Text(name, font_size=16, font=MONO, color=TEXT)
            lbl.next_to(d, DOWN if "Discovery" in name or "Audit" in name else DOWN, buff=0.1)
            tool_dots.add(d)
            tool_labels.add(lbl)

        self.play(Create(tool_dots, lag_ratio=0.15), run_time=1.2)
        self.wait(0.3)

        for dot, lbl in zip(tool_dots, tool_labels):
            line = Line(dot, center_dot, color=PRIMARY,
                        stroke_width=1, stroke_opacity=0.4)
            self.play(Create(line, run_time=0.2), FadeIn(lbl, run_time=0.3), lag_ratio=0)

        count = Text("17 tools", font_size=34, font=MONO, weight=BOLD, color=ACCENT)
        count.next_to(core, DOWN, buff=2.8)

        self.play(FadeIn(count, run_time=0.8))
        self.wait(2.0)

        self.play(make_full_scene_bg(list(core) + list(tool_dots) + list(tool_labels) + [count]),
                  run_time=0.5)
        self.wait(0.2)


# ============================================================================
# SCENE 4 — Keyword Discovery
# ============================================================================
class Scene4_Keyword(Scene):
    def construct(self):
        self.camera.background_color = BG
        self.add_subcaption("Keyword Discovery — AI finds high-opportunity, low-competition keywords", duration=3)

        title = Text("Keyword Discovery",
                     font_size=36, font=MONO, weight=BOLD, color=PRIMARY)
        title.to_edge(UP, buff=0.4)
        self.play(Write(title), run_time=0.8)

        # Input bar
        input_bar = RoundedRectangle(corner_radius=8,
                                     height=0.55, width=8.0, fill_opacity=0.2,
                                     fill_color=PRIMARY, stroke_color=PRIMARY,
                                     stroke_width=1.5)
        input_bar.next_to(title, DOWN, buff=0.5)
        placeholder = Text('"best drone 2026"', font_size=22, font=MONO, color=TEXT)
        placeholder.move_to(input_bar.get_center())
        self.play(Create(input_bar), run_time=0.6)
        self.play(FadeIn(placeholder), run_time=0.4)

        discover_btn = RoundedRectangle(corner_radius=6, height=0.45, width=2.0,
                                        fill_opacity=0.9, fill_color=SECONDARY)
        discover_btn.next_to(input_bar, DOWN, buff=0.35)
        btn_txt = Text("🚀 Discover Keywords",
                       font_size=18, font=MONO, color=WHITE, weight=BOLD)
        btn_txt.move_to(discover_btn.get_center())
        self.play(Create(discover_btn), Write(btn_txt), run_time=0.6)

        # Score headings
        headers = ["KEYWORD", "VOL", "COMP", "INTENT", "SCORE"]
        row_labels = VGroup()
        col_x = [-3.6, -0.6, 0.8, 2.1, 3.4]
        for i, (hdr, x) in enumerate(zip(headers, col_x)):
            t = Text(hdr, font_size=16, font=MONO, color=MUTED)
            t.move_to([x, 0.4, 0])
            row_labels.add(t)
        self.play(FadeIn(row_labels, lag_ratio=0.1), run_time=0.6)

        rows = [
            ("best drone for beginners", "12K", "Low",  "Commercial", 92, ACCENT),
            ("drone photography tips",   "8.2K","Med",  "Informational", 87, ACCENT),
            ("dji mini 3 pro review",    "33K", "High", "Informational", 78, WARN_RED),
            ("long range fpv drones",    "2.9K", "Low", "Informational", 92, ACCENT),
            ("drone laws UK 2026",       "1.8K", "Low", "Informational", 95, ACCENT),
            ("best gimbal for drone",    "3.2K", "Med", "Commercial", 82, ACCENT),
        ]
        row_mobs = VGroup()
        for i, (kw, vol, comp, intent, score, col) in enumerate(rows):
            y = -0.55 - i * 0.65
            kw_m  = Text(kw, font_size=17, font=MONO, color=TEXT)
            vol_m = Text(vol, font_size=18, font=MONO, color=TEXT)
            comp_m= Text(comp, font_size=18, font=MONO, color=TEXT)
            int_m = Text(intent, font_size=18, font=MONO, color=TEXT)
            sc_m  = Text(str(score), font_size=24, font=MONO, weight=BOLD, color=col)

            kw_m.align_to(ORIGIN + [-3.6, y, 0], LEFT)
            vol_m.align_to(ORIGIN + [-0.6, y, 0], LEFT)
            comp_m.align_to(ORIGIN + [0.8, y, 0], LEFT)
            int_m.align_to(ORIGIN + [2.1, y, 0], LEFT)
            sc_m.align_to(ORIGIN + [3.4, y, 0], LEFT)
            for m in [kw_m, vol_m, comp_m, int_m, sc_m]:
                row_mobs.add(m)
            row_mobs[-5].shift([-3.6, y, 0])
            row_mobs[-4].shift([-0.6, y, 0])
            row_mobs[-3].shift([0.8,  y, 0])
            row_mobs[-2].shift([2.1,  y, 0])
            row_mobs[-1].shift([3.4,  y, 0])

        for i in range(0, len(row_mobs), 5):
            self.play(FadeIn(VGroup(*row_mobs[i:i+5]), run_time=0.35),
                      lag_ratio=0)
            self.wait(0.12)

        self.wait(2.0)
        all_mobs = [title, input_bar, placeholder, discover_btn, btn_txt]
        all_mobs += list(row_labels) + list(row_mobs)
        self.play(make_full_scene_bg(all_mobs),
            run_time=0.5)
        self.wait(0.2)


# ============================================================================
# SCENE 5 — SEO Audit
# ============================================================================
class Scene5_Audit(Scene):
    def construct(self):
        self.camera.background_color = BG
        self.add_subcaption("SEO Audit — paste any URL, get a full scorecard with AI fix suggestions", duration=3)

        title = Text("SEO Audit Tool",
                     font_size=36, font=MONO, weight=BOLD, color=PRIMARY)
        title.to_edge(UP, buff=0.4)
        self.play(Write(title), run_time=0.8)

        url_bar = Text("https://youtube.com/watch?v=_demo_video_",
                       font_size=20, font=MONO, color=TEXT)
        url_bar.next_to(title, DOWN, buff=0.5)

        cursor = Text("|", font_size=20, font=MONO,
                      color=ACCENT).next_to(url_bar, RIGHT)
        self.play(FadeIn(url_bar), run_time=0.5)

        run_btn = Text("▶ Run Audit",
                       font_size=22, font=MONO, weight=BOLD, color=PRIMARY)
        run_btn.next_to(url_bar, RIGHT, buff=1.0)
        self.play(Write(run_btn), run_time=0.6)

        # Scorecard
        categories = [("Title", 85, ACCENT), ("Description", 60, WARN_RED),
                      ("Tags", 72, "#FFB800"), ("Thumbnail", 65, WARN_RED)]
        card = RoundedRectangle(corner_radius=12, height=4.0, width=7.5,
                                fill_opacity=0.08, stroke_color=PRIMARY, stroke_width=1.5)
        card.next_to(url_bar, DOWN, buff=0.6)

        score_mobs = VGroup()
        for i, (label, score, col) in enumerate(categories):
            y_off = 1.4 - i * 0.85
            lbl_m = Text(label, font_size=22, font=MONO, color=TEXT)
            lbl_m.move_to([-2.0, y_off, 0])
            score_m = Text(str(score), font_size=34, font=MONO, weight=BOLD, color=col)
            score_m.move_to([2.2, y_off - 0.12, 0])
            score_mobs.add(lbl_m, score_m)

        self.play(Create(card), FadeIn(score_mobs, lag_ratio=0.15), run_time=1.2)
        self.wait(2.0)

        all_mobs = [title, url_bar, cursor, run_btn, card] + list(score_mobs)
        self.play(make_full_scene_bg(all_mobs),
                  run_time=0.5)
        self.wait(0.2)


# ============================================================================
# SCENE 6 — Script Generator
# ============================================================================
class Scene6_Script(Scene):
    def construct(self):
        self.camera.background_color = BG
        self.add_subcaption("Script Generator — give it a topic, get a structured script", duration=3)

        title = Text("Script Generator",
                     font_size=36, font=MONO, weight=BOLD, color=PRIMARY)
        title.to_edge(UP, buff=0.4)
        self.play(Write(title), run_time=0.8)

        topic_box = RoundedRectangle(corner_radius=8, height=0.6, width=7.5,
                                     fill_opacity=0.15, stroke_color=SECONDARY, stroke_width=1.5)
        topic_box.next_to(title, DOWN, buff=0.5)
        topic_txt = Text('"5 drone tips every beginner needs to know"',
                         font_size=22, font=MONO, color=TEXT)
        topic_txt.move_to(topic_box.get_center())
        self.play(Create(topic_box), FadeIn(topic_txt), run_time=0.8)

        generate_btn = Text("⚡ Generate Script",
                            font_size=22, font=MONO, weight=BOLD, color=PRIMARY)
        generate_btn.next_to(topic_box, DOWN, buff=0.4)
        self.play(Write(generate_btn), run_time=0.6)

        # Script output skeleton
        script_lines = [
            ("[HOOK]  Hey, tired of crashing your drone on day one?", "#00F5FF"),
            ("[TIP 1]  Check your GPS lock before every flight.", "#7B61FF"),
            ("[TIP 2]  Low-light flights kill your footage.", "#7B61FF"),
            ("[TIP 3]  Keep speed low until you know the controller.", "#7B61FF"),
            ("[CTA]   Subscribe for more drone basics.", "#39FF14"),
        ]
        script_mobs = VGroup()
        for i, (ln, col) in enumerate(script_lines):
            t = Text(ln, font_size=20, font=MONO, color=col)
            t.shift(DOWN * (1.2 - i * 0.65))
            script_mobs.add(t)

        self.play(FadeIn(script_mobs, lag_ratio=0.12), run_time=1.5)
        self.wait(2.0)

        all_mobs = [title, topic_box, topic_txt, generate_btn] + list(script_mobs)
        self.play(make_full_scene_bg(all_mobs),
                  run_time=0.5)
        self.wait(0.2)


# ============================================================================
# SCENE 7 — CTA
# ============================================================================
class Scene7_CTA(Scene):
    def construct(self):
        self.camera.background_color = BG
        self.add_subcaption("Start free — 100 credits, no credit card required", duration=3)

        big = Text("Start Free",
                   font_size=60, font=MONO, weight=BOLD, color=PRIMARY)
        self.play(Write(big), run_time=1.2)
        self.wait(0.5)

        credits = Text("100 free credits — no credit card",
                       font_size=26, font=MONO, color=TEXT)
        credits.next_to(big, DOWN, buff=0.5)
        self.play(FadeIn(credits), run_time=0.7)

        url = Text("youtube-seo-architect.vercel.app",
                   font_size=20, font=MONO, color=MUTED)
        url.next_to(credits, DOWN, buff=0.4)
        self.play(FadeIn(url), run_time=0.5)

        self.wait(2.5)

        self.play(make_full_scene_bg([big, credits, url]), run_time=0.6)
        self.wait(0.3)


if __name__ == "__main__":
    # ── draft passes ──────────────────────────────────────────────────────
    # manim -ql manim-video.py Scene1_Opening Scene2_Problem ...
    # ── production pass ───────────────────────────────────────────────────
    # manim -qh manim-video.py Scene1_Opening ...
    pass
