import base64
import gzip
import json
from pathlib import Path


# =========================
# 配置
# =========================

INPUT_FILE = Path("RAW.json")
OUTPUT_FILE = Path("fences.json")


def decode_geom(encoded_geom: str) -> dict:
    """
    解码电子围栏 geom 字段。

    原始格式：
        Base64 String
            ↓
        Base64 Decode
            ↓
        GZIP Decode
            ↓
        UTF-8 JSON
            ↓
        GeoJSON Geometry
    """

    compressed_data = base64.b64decode(encoded_geom)

    json_bytes = gzip.decompress(compressed_data)

    json_text = json_bytes.decode("utf-8")

    return json.loads(json_text)


def convert_fence(raw_fence: dict) -> dict:
    """
    将原始电子围栏转换为网页使用的标准格式。
    """

    geometry = decode_geom(raw_fence["geom"])

    couriers = []

    for entity in raw_fence.get("bindEntityList", []):
        couriers.append({
            "entityId": entity.get("entityId"),
            "name": entity.get("entityName"),
            "mobile": entity.get("mobile"),
            "entityType": entity.get("entityType")
        })

    return {
        "fenceId": raw_fence.get("fenceId"),
        "lbsFenceId": raw_fence.get("lbsFenceId"),
        "fenceName": raw_fence.get("fenceName"),

        "provinceName": raw_fence.get("provinceName"),
        "cityName": raw_fence.get("cityName"),

        "geometry": geometry,

        "couriers": couriers
    }


def main():

    print(f"读取文件: {INPUT_FILE}")

    with INPUT_FILE.open(
        "r",
        encoding="utf-8"
    ) as file:

        raw_data = json.load(file)

    print(f"原始围栏数量: {len(raw_data)}")

    fences = []

    success_count = 0
    error_count = 0

    for index, raw_fence in enumerate(raw_data):

        try:

            fence = convert_fence(raw_fence)

            fences.append(fence)

            success_count += 1

        except Exception as error:

            error_count += 1

            print(
                f"[解析失败]"
                f" index={index}"
                f" fenceId={raw_fence.get('fenceId')}"
                f" fenceName={raw_fence.get('fenceName')}"
                f" error={error}"
            )

    output_data = {
        "metadata": {
            "coordinateSystem": "GCJ-02",
            "geometryFormat": "GeoJSON",
            "fenceCount": len(fences)
        },

        "fences": fences
    }

    with OUTPUT_FILE.open(
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            output_data,
            file,
            ensure_ascii=False,
            indent=2
        )

    print()
    print("=========================")
    print("转换完成")
    print("=========================")
    print(f"成功: {success_count}")
    print(f"失败: {error_count}")
    print(f"输出: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()