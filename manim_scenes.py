"""Self-teaching manim scenes for the YouTube-title tutorial (mute-safe).

Every scene is duration-matched to its narration clip and split into
distinct visual beats (~1 per 7s). Charts/bars/numbers carry the meaning
on their own so the video teaches on mute. Renders 1280x720@30.
"""
import json
import os

from manim import (
    Scene, Text, Rectangle, RoundedRectangle, Line, Arrow, VGroup, Dot,
    WHITE, BLACK, BLUE, GREEN, RED, YELLOW, ORANGE,
    UP, DOWN, LEFT, RIGHT, ORIGIN,
    FadeIn, FadeOut, GrowFromEdge, GrowFromCenter, Create, Indicate,
    Transform, Write, ScaleInPlace, MoveToTarget, config,
)

BASE = os.path.join(os.path.expanduser("~"), "OpenMontage")
PROJ = os.path.join(BASE, "projects", "youtube-title-examples-2026")
TIMELINE = json.load(open(os.path.join(PROJ, "timeline.json"), encoding="utf-8"))
DURS = {}
for i, s in enumerate(TIMELINE):
    num = s["scene"]
    lead = 0.0 if i == 0 else 0.25
    tail = 1.0 if i == len(TIMELINE) - 1 else 0.35
    DURS[num] = lead + s["audio_dur"] + tail

CYAN = "#22d3ee"
GREEN_C = "#34d399"
RED_C = "#ef4444"
YELLOW_C = "#fbbf24"
SLATE = "#e2e8f0"
MUTED = "#94a3b8"
BG_COLOR = "#0F172A"

config.background_color = BG_COLOR
config.frame_width = 14.22
config.frame_height = 8.0
config.frame_rate = 30


def pad(scene, D):
    remaining = D - scene.time
    if remaining > 0.01:
        scene.wait(remaining)


def chip(text, color, pos, size=30):
    t = Text(text, font_size=size, color=color)
    box = RoundedRectangle(width=t.width + 0.7, height=t.height + 0.5,
                           corner_radius=0.2, color=color, stroke_opacity=0.6)
    box.set_fill(color, opacity=0.10)
    box.move_to(pos)
    t.move_to(pos)
    return VGroup(box, t)


def bar(x, y0, w, h, color):
    b = Rectangle(width=w, height=h, color=color).set_fill(color, opacity=0.75)
    b.move_to([x, y0 + h / 2, 0])
    return b


# ────────────────────────────────────────────────────────────────────────────

class Scene01Hero(Scene):
    D = DURS[1]

    def construct(self):
        kick = Text("THE TITLE THAT WINS", font_size=30, color=CYAN).to_edge(UP)
        self.play(FadeIn(kick))
        num = Text("+36%", font_size=110, color=GREEN_C).move_to([0, 1.0, 0])
        sub = Text("more clicks with a number", font_size=34, color=SLATE).next_to(num, DOWN, buff=0.3)
        self.play(GrowFromCenter(num), FadeIn(sub))
        f1 = chip("NUMBER", CYAN, [-3.4, -1.9, 0], 32)
        f2 = chip("BENEFIT", GREEN_C, [0, -1.9, 0], 32)
        f3 = chip("TIMEFRAME", YELLOW_C, [3.4, -1.9, 0], 32)
        plus1 = Text("+", font_size=44, color=MUTED).move_to([-1.7, -1.9, 0])
        plus2 = Text("+", font_size=44, color=MUTED).move_to([1.7, -1.9, 0])
        self.play(FadeIn(f1), FadeIn(f2), FadeIn(f3), FadeIn(plus1), FadeIn(plus2))
        self.play(Indicate(f1), Indicate(f2), Indicate(f3))
        pad(self, self.D)


class Scene02ThreeJobs(Scene):
    D = DURS[2]

    def construct(self):
        title = Text("A great title does 3 jobs", font_size=40, color=SLATE).to_edge(UP)
        self.play(FadeIn(title))
        rows = [("1 · SEARCH", "keyword placement", CYAN, 1.6),
                ("2 · CURIOSITY", "makes them stop", YELLOW_C, 0.0),
                ("3 · ACCURACY", "keeps the promise", GREEN_C, -1.6)]
        for label, sub, color, y in rows:
            t = Text(label, font_size=46, color=color).move_to([0, y + 0.4, 0])
            s = Text(sub, font_size=28, color=MUTED).next_to(t, DOWN, buff=0.15)
            self.play(GrowFromEdge(t, LEFT), FadeIn(s))
        pad(self, self.D)


class Scene03Formula(Scene):
    D = DURS[3]

    def construct(self):
        # beat 1: formula breakdown
        title = Text("THE WINNING FORMULA", font_size=32, color=CYAN).to_edge(UP)
        self.play(FadeIn(title))
        blocks = [("NUMBER", CYAN, [-4.0, 0.6, 0]),
                  ("BENEFIT", GREEN_C, [0, 0.6, 0]),
                  ("TIMEFRAME", YELLOW_C, [4.0, 0.6, 0])]
        bxs = []
        for label, color, pos in blocks:
            b = RoundedRectangle(width=3.4, height=1.5, corner_radius=0.2,
                                 color=color).set_fill(color, opacity=0.12)
            b.move_to(pos)
            t = Text(label, font_size=34, color=color).move_to(pos)
            bxs.append(VGroup(b, t))
        self.play(*[FadeIn(b, scale=0.8) for b in bxs])
        plus = [Text("+", font_size=48, color=MUTED).move_to([-2.0, 0.6, 0]),
                Text("+", font_size=48, color=MUTED).move_to([2.0, 0.6, 0])]
        self.play(*[FadeIn(p) for p in plus])
        self.wait(0.6)

        # beat 2: example title with parts highlighted
        ex = Text("5 Ways to Double Your\nYouTube Views in 30 Days",
                  font_size=38, color=SLATE, line_spacing=0.4).to_edge(DOWN).shift(UP * 0.2)
        self.play(FadeIn(ex))
        self.play(Indicate(ex, scale_factor=1.08))

        # beat 3: bar chart of median CTR by formula
        self.play(*[FadeOut(g) for g in bxs], *[FadeOut(p) for p in plus], FadeOut(ex), FadeOut(title))
        ctitle = Text("Median CTR by formula (%)", font_size=30, color=SLATE).to_edge(UP)
        self.play(FadeIn(ctitle))
        bars = [("Generic", 4.2, MUTED), ("Curiosity", 6.1, YELLOW_C),
                ("Negative", 7.3, RED_C), ("Num+Benefit", 8.7, GREEN_C)]
        gs = []
        for i, (label, val, color) in enumerate(bars):
            h = val / 10 * 4.2
            b = bar(-4.4 + 2.9 * i, -2.2, 1.5, h, color)
            lbl = Text(label, font_size=22, color=MUTED).next_to(b, DOWN, buff=0.12)
            v = Text(f"{val:.1f}", font_size=30, color=color).next_to(b, UP, buff=0.1)
            gs.append(VGroup(b, lbl, v))
        self.play(*[GrowFromEdge(g[0], DOWN) for g in gs])
        self.play(*[FadeIn(g[1]) for g in gs], *[FadeIn(g[2]) for g in gs])
        winner = gs[3][0].copy().set_stroke(CYAN, width=6)
        self.play(Create(winner), Indicate(gs[3][2]))
        pad(self, self.D)


class Scene04Data(Scene):
    D = DURS[4]

    def construct(self):
        title = Text("WHAT THE DATA SAYS", font_size=32, color=CYAN).to_edge(UP)
        self.play(FadeIn(title))
        # beat 1: big +36% bar
        b36 = bar(-4.6, -2.2, 2.6, 4.4, GREEN_C)
        l36 = Text("+36%", font_size=44, color=GREEN_C).next_to(b36, UP, buff=0.15)
        s36 = Text("numbers lift CTR", font_size=26, color=SLATE).next_to(b36, DOWN, buff=0.15)
        self.play(GrowFromEdge(b36, DOWN), FadeIn(l36), FadeIn(s36))
        # beat 2: more bars appear to the right
        others = [("odd > even", 3.4, YELLOW_C), ("front-load +14%", 2.6, CYAN),
                  ("specificity 2.3x", 2.1, GREEN_C)]
        for i, (label, h, color) in enumerate(others):
            x = 1.6 + i * 2.1
            b = bar(x, -2.2, 1.4, h, color)
            t = Text(label, font_size=22, color=color).next_to(b, UP, buff=0.1)
            self.play(GrowFromEdge(b, DOWN), FadeIn(t))
        # beat 3: 40-60 length gauge
        g = Rectangle(width=4.0, height=0.5, color=MUTED).move_to([0, -3.1, 0])
        g.set_fill(MUTED, opacity=0.3)
        good = Rectangle(width=1.6, height=0.5, color=GREEN_C).move_to([0.4, -3.1, 0])
        good.set_fill(GREEN_C, opacity=0.9)
        g40 = Text("40", font_size=26, color=SLATE).next_to(good, DOWN, buff=0.1)
        g60 = Text("60", font_size=26, color=SLATE).next_to(good, DOWN, buff=0.1).shift(RIGHT * 1.6)
        lab = Text("best length (characters)", font_size=24, color=MUTED).next_to(g, DOWN, buff=0.5)
        self.play(FadeIn(g), FadeIn(good), FadeIn(g40), FadeIn(g60), FadeIn(lab))
        pad(self, self.D)


class Scene05Patterns(Scene):
    D = DURS[5]

    def construct(self):
        title = Text("3 MORE PATTERNS THAT CLICK", font_size=32, color=CYAN).to_edge(UP)
        self.play(FadeIn(title))
        # beat 1: curiosity gap (a question bar that fills)
        q = Text("CURIOSITY GAP", font_size=30, color=YELLOW_C).move_to([-3.9, 1.6, 0])
        self.play(FadeIn(q))
        gap = bar(-3.9, -1.0, 3.2, 1.6, YELLOW_C)
        qmark = Text("??  →  click", font_size=30, color=YELLOW_C).next_to(gap, DOWN, buff=0.2)
        self.play(GrowFromEdge(gap, DOWN), FadeIn(qmark))
        # beat 2: negative framing bars
        nl = Text("NEGATIVE FRAMING", font_size=30, color=RED_C).move_to([3.9, 1.9, 0])
        self.play(FadeIn(nl))
        b_tip = bar(2.6, -1.0, 1.8, 2.4, MUTED)
        b_mis = bar(5.2, -1.0, 1.8, 3.4, GREEN_C)
        lt = Text("5 Tips", font_size=24, color=MUTED).next_to(b_tip, DOWN, buff=0.15)
        lm = Text("5 Mistakes", font_size=24, color=GREEN_C).next_to(b_mis, DOWN, buff=0.15)
        vm = Text("+27%", font_size=34, color=GREEN_C).next_to(b_mis, UP, buff=0.1)
        self.play(GrowFromEdge(b_tip, DOWN), GrowFromEdge(b_mis, DOWN),
                  FadeIn(lt), FadeIn(lm), FadeIn(vm))
        # beat 3: year-forward + question chips
        c1 = chip("YEAR-FORWARD · 2026", CYAN, [-2.0, -2.6, 0], 26)
        c2 = chip("HONEST QUESTION", GREEN_C, [2.0, -2.6, 0], 26)
        self.play(FadeIn(c1), FadeIn(c2))
        pad(self, self.D)


class Scene06Workflow(Scene):
    D = DURS[6]

    def construct(self):
        title = Text("THE 6-STEP WORKFLOW", font_size=32, color=CYAN).to_edge(UP)
        self.play(FadeIn(title))
        steps = [("1", "RESEARCH keywords"), ("2", "PICK the formula"), ("3", "WRITE 10 variations"),
                 ("4", "TRIM to 40-60"), ("5", "SCORE vs competition"), ("6", "VERIFY the promise")]
        ys = [2.4, 1.2, 0.0, -1.2, -2.4, -3.6]
        for i, ((n, t), y) in enumerate(zip(steps, ys)):
            c = RoundedRectangle(width=1.0, height=1.0, corner_radius=0.25, color=CYAN)
            c.move_to([-4.6, y, 0]).set_fill(CYAN, opacity=0.15)
            cn = Text(n, font_size=30, color=CYAN).move_to(c.get_center())
            txt = Text(t, font_size=30, color=SLATE).next_to(c, RIGHT, buff=0.5)
            self.play(FadeIn(c), FadeIn(cn), FadeIn(txt))
            if i < len(steps) - 1:
                ln = Line(c.get_center() + DOWN * 0.5, [c.get_center()[0], ys[i + 1] + 0.5, 0],
                          color=MUTED, stroke_width=3)
                self.play(Create(ln))
        pad(self, self.D)


class Scene07Retention(Scene):
    D = DURS[7]

    def construct(self):
        title = Text("CTR vs RETENTION", font_size=32, color=CYAN).to_edge(UP)
        self.play(FadeIn(title))
        # tall 12% bar
        tall = bar(-3.2, -2.2, 2.4, 4.8, RED_C)
        t1 = Text("12% CTR", font_size=32, color=RED_C).next_to(tall, UP, buff=0.1)
        t2 = Text("inflates clicks", font_size=24, color=MUTED).next_to(tall, DOWN, buff=0.15)
        self.play(GrowFromEdge(tall, DOWN), FadeIn(t1), FadeIn(t2))
        # collapse
        stub = bar(-3.2, -2.2, 2.4, 0.7, RED_C)
        dead = Text("dies in 15s", font_size=26, color=RED_C).next_to(stub, UP, buff=0.1)
        self.play(Transform(tall, stub), Transform(t1, dead))
        # steady 6-8%
        steady = bar(3.2, -2.2, 2.6, 2.9, GREEN_C)
        s1 = Text("6-8% steady", font_size=32, color=GREEN_C).next_to(steady, UP, buff=0.1)
        s2 = Text("wins every time", font_size=24, color=SLATE).next_to(steady, DOWN, buff=0.15)
        self.play(GrowFromEdge(steady, DOWN), FadeIn(s1), FadeIn(s2))
        warn = Text("NEVER change a ranking title", font_size=28, color=RED_C).to_edge(DOWN)
        self.play(FadeIn(warn))
        pad(self, self.D)


class Scene08CTA(Scene):
    D = DURS[8]

    def construct(self):
        big = Text("SCORE YOUR TITLE FREE", font_size=40, color=CYAN).to_edge(UP)
        self.play(FadeIn(big))
        num = Text("36%", font_size=120, color=GREEN_C).move_to([0, 1.0, 0])
        sub = Text("average lift with numbers", font_size=30, color=SLATE).next_to(num, DOWN, buff=0.25)
        self.play(GrowFromCenter(num), FadeIn(sub))
        c1 = chip("12 CTR SIGNALS", CYAN, [-3.4, -2.3, 0], 28)
        c2 = chip("FREE", GREEN_C, [0, -2.3, 0], 28)
        c3 = chip("NO CARD", YELLOW_C, [3.4, -2.3, 0], 28)
        self.play(FadeIn(c1), FadeIn(c2), FadeIn(c3))
        pad(self, self.D)
