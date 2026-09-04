"""Manim render-speed benchmark for the WSL box (no GPU)."""
from manim import Scene, Rectangle, Text, VGroup, WHITE, BLUE, UP, FadeIn, GrowFromCenter, config

config.pixel_width = 1280
config.pixel_height = 720
config.fps = 30
config.quality = "low_quality"


class Bench(Scene):
    def construct(self):
        bars = VGroup()
        for i, h in enumerate([0.4, 0.6, 0.8, 1.0]):
            b = Rectangle(width=1.0, height=h * 2.5, color=BLUE).shift(2.2 * (i - 1.5), h * 1.25)
            b.set_fill(BLUE, opacity=0.7)
            bars.add(b)
        self.play(*[GrowFromCenter(b) for b in bars])
        label = Text("benchmark", color=WHITE).to_edge(UP)
        self.play(FadeIn(label))
        self.wait(0.5)
