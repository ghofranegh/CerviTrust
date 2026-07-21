import unittest
from PIL import Image

from utils.api import predict


class SegmentationFallbackTests(unittest.TestCase):
    def test_predict_returns_visible_segmentation_masks(self):
        image = Image.new("RGB", (224, 224), color="lightblue")
        result = predict(image)

        segmentation = result.get("segmentation") or {}
        self.assertIsInstance(segmentation, dict)
        self.assertTrue(segmentation.get("overlay"))
        self.assertTrue(segmentation.get("background"))
        self.assertTrue(segmentation.get("cytoplasm"))
        self.assertTrue(segmentation.get("nucleus"))


if __name__ == "__main__":
    unittest.main()
