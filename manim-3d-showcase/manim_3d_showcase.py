"""
Manim 3D Showcase - 60-second YouTube SEO video
Demonstrates Manim CE v0.20.1 3D capabilities:
  - 3D objects (Sphere, Cube, Torus, Cone, Cylinder)
  - Parametric surfaces (torus knot, mobius, wave)
  - Camera movement (orbit, dolly, crane, zoom)
  - 3D text labels
  - Multi-object compositions

Uses OpenGL renderer for hardware-accelerated 3D.
"""

from manim import *
import numpy as np
from manim.mobject.three_d.three_dimensions import ThreeDVMobject

config.renderer = RendererType.OPENGL
config.frame_rate = 15
config.pixel_height = 480
config.pixel_width = 854


class ThreeDText(Text, ThreeDVMobject):
    """Text that behaves as a 3D mobject (depth, lighting)."""
    pass


# Palette
C_CYAN   = "#00d4ff"
C_PINK   = "#ff6b9d"
C_GOLD   = "#ffd700"
C_PURPLE = "#a855f7"
C_GREEN  = "#22c55e"
C_ORANGE = "#f97316"


class Manim3DShowcase(ThreeDScene):
    """60-second showcase of Manim 3D capabilities."""

    def make_label(self, text, color="#ffffff", scale=0.4):
        t = ThreeDText(text, color=color, font_size=36)
        t.depth = 0.05
        t.scale(scale)
        return t

    # --- Scene 1: Opening Title (0-10s) ---
    def scene_title(self):
        self.camera.background_color = "#0a0a1a"
        self.camera.frame_center = ORIGIN

        title = ThreeDText("Manim 3D", color=C_CYAN, font_size=96)
        title.depth = 0.4
        subtitle = ThreeDText(
            "Mathematical Animation Engine", color="#888888", font_size=36
        )
        subtitle.depth = 0.1
        subtitle.next_to(title, DOWN, buff=0.5)

        ring = Torus(
            major_radius=2.2, minor_radius=0.08,
            color=C_PINK, resolution=(24, 12),
        )
        ring.rotate(PI / 2, axis=RIGHT)

        self.set_camera_orientation(phi=70 * DEGREES, theta=-45 * DEGREES)
        self.play(Write(title), Write(subtitle), GrowFromCenter(ring),
                  rate_func=smooth, run_time=3)
        self.begin_ambient_camera_rotation(rate=0.08, about="theta")
        self.wait(3)
        self.stop_ambient_camera_rotation()

        self.play(
            FadeOut(title, shift=UP * 0.3),
            FadeOut(subtitle, shift=UP * 0.2),
            FadeOut(ring, scale=1.5),
            run_time=2,
        )
        self.wait(0.3)

    # --- Scene 2: 3D Objects Gallery (10-28s) ---
    def scene_objects(self):
        self.set_camera_orientation(phi=60 * DEGREES, theta=-30 * DEGREES)

        grid = NumberPlane(
            x_range=[-4, 4, 1], y_range=[-4, 4, 1],
            background_line_style={
                "stroke_color": "#444444",
                "stroke_width": 0.5,
                "stroke_opacity": 0.3,
            },
            faded_line_ratio=2,
        )
        grid.shift(DOWN * 0.3)
        self.add(grid)

        objects_data = [
            (Sphere(radius=0.55, resolution=(16, 16), color=C_CYAN), "Sphere"),
            (Cube(side_length=0.9, color=C_PINK), "Cube"),
            (Torus(major_radius=0.65, minor_radius=0.2, color=C_GOLD, resolution=(16, 12)), "Torus"),
            (Cone(base_radius=0.55, height=0.9, color=C_GREEN), "Cone"),
            (Cylinder(radius=0.45, height=0.9, color=C_PURPLE), "Cylinder"),
        ]

        n = len(objects_data)
        angle_step = 2 * PI / n
        radius = 2.5

        for i, (obj, name) in enumerate(objects_data):
            angle = angle_step * i - PI / 2
            obj.move_to([radius * np.cos(angle), 0, radius * np.sin(angle)])
            label = self.make_label(name, scale=0.3)
            label.next_to(obj, DOWN, buff=0.3)
            self.add(obj, label)
            self.play(Rotate(obj, angle=2 * PI, axis=UP, run_time=1.2),
                      rate_func=smooth)
            self.wait(0.15)

        self.begin_ambient_camera_rotation(rate=0.06, about="theta")
        self.wait(3)
        self.stop_ambient_camera_rotation()

        self.play(FadeOut(grid), run_time=1.5)
        self.wait(0.3)

    # --- Scene 3: Parametric Surfaces (28-43s) ---
    def scene_surfaces(self):
        self.set_camera_orientation(phi=70 * DEGREES, theta=-30 * DEGREES)

        # Torus Knot
        def knot(u, v):
            R, r, p, q = 1.8, 0.6, 3, 2
            theta = u * TAU
            phi = v * TAU + theta * q / p
            return np.array([
                (R + r * np.cos(phi)) * np.cos(theta),
                (R + r * np.cos(phi)) * np.sin(theta),
                r * np.sin(phi),
            ])

        knot_sfc = Surface(
            knot, u_range=(0, 1), v_range=(0, 1),
            resolution=(24, 18), color=C_CYAN,
            checkerboard_colors=[C_CYAN, "#0088aa"],
        )
        knot_sfc.scale(0.75)
        lbl1 = self.make_label("Torus Knot", C_CYAN, scale=0.35)
        lbl1.next_to(knot_sfc, DOWN, buff=0.5)
        self.play(Write(knot_sfc), Write(lbl1), run_time=2)
        self.begin_ambient_camera_rotation(rate=0.1, about="theta")
        self.wait(3)
        self.stop_ambient_camera_rotation()
        self.play(FadeOut(knot_sfc, shift=OUT * 0.5),
                  FadeOut(lbl1, shift=UP * 0.3), run_time=1.5)

        # Mobius Strip
        def mobius(u, v):
            theta = u * TAU
            w = v - 0.5
            r = 1.8
            return np.array([
                (r + w * 0.6 * np.cos(theta / 2)) * np.cos(theta),
                (r + w * 0.6 * np.cos(theta / 2)) * np.sin(theta),
                w * 0.6 * np.sin(theta / 2),
            ])

        mobius_sfc = Surface(
            mobius, u_range=(0, 1), v_range=(0, 1),
            resolution=(24, 12), color=C_PINK,
            checkerboard_colors=[C_PINK, "#cc4477"],
        )
        lbl2 = self.make_label("Mobius Strip", C_PINK, scale=0.35)
        lbl2.next_to(mobius_sfc, DOWN, buff=0.5)
        self.play(Write(mobius_sfc), Write(lbl2), run_time=2)
        self.begin_ambient_camera_rotation(rate=0.12, about="theta")
        self.wait(3)
        self.stop_ambient_camera_rotation()
        self.play(FadeOut(mobius_sfc, shift=OUT * 0.5),
                  FadeOut(lbl2, shift=UP * 0.3), run_time=1.5)

        # Wave Surface
        def wave(u, v):
            x = u * 6 - 3
            y = v * 6 - 3
            z = 0.8 * np.sin(np.sqrt(x**2 + y**2) * 1.5 - 2)
            return np.array([x, y, z])

        wave_sfc = Surface(
            wave, u_range=(0, 1), v_range=(0, 1),
            resolution=(32, 32), color=C_GREEN,
            checkerboard_colors=[C_GREEN, "#16883d"],
        )
        lbl3 = self.make_label("Wave Surface", C_GREEN, scale=0.35)
        lbl3.next_to(wave_sfc, DOWN, buff=0.5)
        self.play(Write(wave_sfc), Write(lbl3), run_time=2)
        self.begin_ambient_camera_rotation(rate=0.08, about="theta")
        self.wait(2.5)
        self.stop_ambient_camera_rotation()
        self.play(FadeOut(wave_sfc, shift=DOWN),
                  FadeOut(lbl3, shift=DOWN * 0.3), run_time=1.5)
        self.wait(0.3)

    # --- Scene 4: Camera Showcase (43-53s) ---
    def scene_camera(self):
        self.set_camera_orientation(phi=60 * DEGREES, theta=-45 * DEGREES)

        center = Sphere(radius=0.4, color=C_GOLD, resolution=(16, 16))

        orbiters = VGroup()
        colors = [C_CYAN, C_PINK, C_PURPLE, C_GREEN, C_ORANGE, C_GOLD]
        for i in range(6):
            angle = i * TAU / 6
            orbiter = Cube(side_length=0.25, color=colors[i % 6])
            orbiter.move_to([1.5 * np.cos(angle), 0.2, 1.5 * np.sin(angle)])
            orbiters.add(orbiter)

        rings = VGroup()
        for i in range(3):
            ring = Circle(radius=1.5, color="#555555", stroke_width=1, stroke_opacity=0.4)
            ring.shift(UP * 0.2)
            ring.rotate(i * PI / 3, axis=UP)
            rings.add(ring)

        self.play(
            *[GrowFromCenter(o) for o in orbiters],
            GrowFromCenter(center),
            *[Write(r) for r in rings],
            run_time=2,
        )

        self.begin_ambient_camera_rotation(rate=0.12, about="theta")
        self.wait(2)
        self.stop_ambient_camera_rotation()

        self.move_camera(phi=30 * DEGREES, theta=0, run_time=2)
        self.wait(0.3)
        self.move_camera(phi=60 * DEGREES, theta=-90 * DEGREES, run_time=2)
        self.wait(0.3)
        self.move_camera(phi=80 * DEGREES, theta=180 * DEGREES, run_time=2)
        self.wait(0.3)
        self.move_camera(phi=45 * DEGREES, theta=-45 * DEGREES, run_time=2)
        self.wait(1)

        self.play(FadeOut(center), *[FadeOut(o) for o in orbiters],
                  FadeOut(rings), run_time=2)
        self.wait(0.3)

    # --- Scene 5: Outro (53-60s) ---
    def scene_outro(self):
        self.camera.frame_center = ORIGIN
        self.set_camera_orientation(phi=60 * DEGREES, theta=-45 * DEGREES)

        thanks = ThreeDText("Thanks for Watching", color=C_CYAN, font_size=60)
        thanks.depth = 0.25
        sub = ThreeDText(
            "Subscribe for more Manim 3D content", color="#888888", font_size=28
        )
        sub.depth = 0.08
        sub.next_to(thanks, DOWN, buff=0.6)

        deco = Torus(
            major_radius=1.5, minor_radius=0.06,
            color=C_PINK, resolution=(24, 12),
        )

        self.begin_ambient_camera_rotation(rate=0.05, about="theta")
        self.play(Write(thanks), Write(sub), GrowFromCenter(deco), run_time=2)
        self.wait(5)
        self.stop_ambient_camera_rotation()

        self.play(
            *[FadeOut(m, scale=1.5) for m in [thanks, sub, deco]],
            run_time=2,
        )
        self.wait(0.3)

    def construct(self):
        self.camera.background_color = "#0a0a1a"
        self.scene_title()
        self.scene_objects()
        self.scene_surfaces()
        self.scene_camera()
        self.scene_outro()


if __name__ == "__main__":
    scene = Manim3DShowcase()
    scene.render()
