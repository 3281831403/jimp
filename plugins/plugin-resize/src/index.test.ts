import { expect, test, describe } from "vitest";

import { makeTestImage } from "@jimp/test-utils";
import { createJimp } from "@jimp/core";

import { methods, ResizeStrategy } from "./index.js";

const jimp = createJimp({ plugins: [methods], formats: [] });

describe("Resize images", () => {
  const testImages = [
    {
      title: "max contrast 8x8",
      src: jimp.fromBitmap(
        makeTestImage(
          "■■■■□□□□",
          "■■■■□□□□",
          "■■■■□□□□",
          "■■■■□□□□",
          "□□□□■■■■",
          "□□□□■■■■",
          "□□□□■■■■",
          "□□□□■■■■"
        )
      ),
      tests: [
        { mode: "default", size: { height: 4, width: 4 } },
        { mode: "NEAREST_NEIGHBOR", size: { height: 4, width: 4 } },
        { mode: "BILINEAR", size: { height: 4, width: 4 } },
        { mode: "BICUBIC", size: { height: 4, width: 4 } },
        { mode: "HERMITE", size: { height: 4, width: 4 } },
        { mode: "BEZIER", size: { height: 4, width: 4 } },
        { mode: "default", size: { height: 5, width: 2 } },
        { mode: "NEAREST_NEIGHBOR", size: { height: 5, width: 2 } },
        { mode: "BILINEAR", size: { height: 5, width: 2 } },
        { mode: "BICUBIC", size: { height: 5, width: 2 } },
        { mode: "HERMITE", size: { height: 5, width: 2 } },
        { mode: "BEZIER", size: { height: 5, width: 2 } },
      ],
    },
    /**********************************************************************/
    {
      title: "max contrast 12x12 with dots",
      src: jimp.fromBitmap(
        makeTestImage(
          "■■■■■■□□□□□□",
          "■■■■■■□□□□□□",
          "■■■□■■□□■□□□",
          "■■■■■■□□□□□□",
          "■■■■■■□□□□□□",
          "■■■■■■□□□□□□",
          "□□□□□□■■■■■■",
          "□□□□□□■■■■■■",
          "□□□□□□■■■■■■",
          "□□□■□□■■□■■■",
          "□□□□□□■■■■■■",
          "□□□□□□■■■■■■"
        )
      ),
      tests: [
        { mode: "default", size: { height: 6, width: 6 } },
        { mode: "NEAREST_NEIGHBOR", size: { height: 6, width: 6 } },
        { mode: "BILINEAR", size: { height: 6, width: 6 } },
        { mode: "BICUBIC", size: { height: 6, width: 6 } },
        { mode: "HERMITE", size: { height: 6, width: 6 } },
        { mode: "BEZIER", size: { height: 6, width: 6 } },
      ],
    },
    /**********************************************************************/
    {
      title: "mutch contrast 4x4",
      src: jimp.fromBitmap(makeTestImage("▩▩▥▥", "▩▩▥▥", "▥▥▩▩", "▥▥▩▩")),
      tests: [
        { mode: "default", size: { height: 6, width: 6 } },
        { mode: "NEAREST_NEIGHBOR", size: { height: 6, width: 6 } },
        { mode: "BILINEAR", size: { height: 6, width: 6 } },
        { mode: "BICUBIC", size: { height: 6, width: 6 } },
        { mode: "HERMITE", size: { height: 6, width: 6 } },
        { mode: "BEZIER", size: { height: 6, width: 6 } },
      ],
    },
  ];

  testImages.forEach((image) => {
    describe(image.title, () => {
      image.tests.forEach(({ mode: modeType, size }) => {
        test(`to ${modeType} ${size.width}x${size.height}`, () => {
          const mode = ResizeStrategy[modeType as keyof typeof ResizeStrategy];

          expect(
            image.src.clone().resize({
              w: size.width,
              h: size.height,
              mode,
            })
          ).toMatchSnapshot();
        });
      });
    });
  });
});

describe("Alpha-aware resizing", () => {
  function bitmapFromPixels(...pixels: number[]) {
    const data = Buffer.alloc(pixels.length * 4);
    pixels.forEach((pixel, i) => data.writeUInt32BE(pixel >>> 0, i * 4));

    return { width: pixels.length, height: 1, data };
  }

  const interpolatedModes = [
    "BILINEAR",
    "BICUBIC",
    "HERMITE",
    "BEZIER",
  ] as const;

  describe("thin strips keep their content", () => {
    const strips = [
      { title: "1x1", rows: ["□"] },
      { title: "2x1", rows: ["□□"] },
      { title: "4x1", rows: ["□□□□"] },
      { title: "1x4", rows: ["□", "□", "□", "□"] },
    ];

    interpolatedModes.forEach((mode) => {
      strips.forEach(({ title, rows }) => {
        test(`${title} white strip scaled up with ${mode}`, () => {
          const img = jimp
            .fromBitmap(makeTestImage(...rows))
            .resize({ w: 8, h: 8, mode: ResizeStrategy[mode] });

          expect([...img.bitmap.data]).toEqual(new Array(8 * 8 * 4).fill(255));
        });
      });

      test(`4x1 white strip scaled down to 1x1 with ${mode}`, () => {
        const img = jimp
          .fromBitmap(makeTestImage("□□□□"))
          .resize({ w: 1, h: 1, mode: ResizeStrategy[mode] });

        expect([...img.bitmap.data]).toEqual([255, 255, 255, 255]);
      });
    });
  });

  describe("transparent pixels' colors cannot bleed into visible pixels", () => {
    // one opaque white pixel next to a fully transparent pixel that still
    // carries a (invisible) pure red color
    const makeImage = () =>
      jimp.fromBitmap(bitmapFromPixels(0xffffffff, 0xff000000));

    interpolatedModes.forEach((mode) => {
      test(`leftover colors of transparent pixels do not bleed with ${mode}`, () => {
        const img = makeImage().resize({ w: 6, h: 1, mode: ResizeStrategy[mode] });

        for (let x = 0; x < img.bitmap.width; x++) {
          const [r, g, b, a] = [...img.bitmap.data.slice(x * 4, x * 4 + 4)] as [
            number,
            number,
            number,
            number,
          ];

          if (a === 0) {
            // fully transparent pixels carry no color
            expect([r, g, b]).toEqual([0, 0, 0]);
          } else {
            // visible pixels are pure white, never tinted by the hidden red
            expect([r, g, b]).toEqual([255, 255, 255]);
          }
        }
      });
    });

    test("semi-transparent edges stay bright when downscaling", () => {
      const img = jimp
        .fromBitmap(bitmapFromPixels(0xffffffff, 0x00000000))
        .resize({ w: 1, h: 1, mode: ResizeStrategy.BICUBIC });

      const [r, g, b, a] = [...img.bitmap.data] as [
        number,
        number,
        number,
        number,
      ];

      // the average of white and nothing is (dimmer) white, not gray
      expect([r, g, b]).toEqual([255, 255, 255]);
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThan(255);
    });
  });
});
