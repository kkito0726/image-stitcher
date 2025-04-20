import cv2


def stitch(read_img, select_mode):

    if select_mode == "Scans":
        stitcher = cv2.Stitcher.create(mode=cv2.Stitcher_SCANS)
        print(f"{select_mode}モードで実行")

    else:
        stitcher = cv2.Stitcher.create()
        print(f"{select_mode}モードで実行")

    result = stitcher.stitch(read_img)

    if result[0] == 0:
        stitched = result[1]

        return stitched, result[0]

    elif result[0] == 1:
        return None, result[0]


if __name__ == "__main__":
    stitch()
