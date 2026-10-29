import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { Objects, Topology } from "topojson-specification";

// 台灣地圖共用工具：台電行政區地圖與台灣指標縣市著色地圖共用同一份 TopoJSON 與投影邏輯
export const countyTopologyPath = "/maps/taiwan-county.json";
export const townTopologyPath = "/maps/taiwan-town.json";

// 縣市由北到南、本島到離島的排列順序，給清單與排名預設排序用
export const countyGeographicOrder = [
  "基隆市",
  "臺北市",
  "新北市",
  "桃園市",
  "新竹縣",
  "新竹市",
  "苗栗縣",
  "臺中市",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義縣",
  "嘉義市",
  "臺南市",
  "高雄市",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "臺東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
];

export interface CountyProperties extends Record<string, unknown> {
  COUNTYNAME: string;
}

export interface TownProperties extends CountyProperties {
  TOWNNAME: string;
}

// 地圖檔用「臺」，站內資料多用「台」，比對前統一成「台」
export function normalizeAreaName(value: string) {
  return value.replaceAll("臺", "台");
}

export async function loadTopology<T extends Objects>(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`載入地圖失敗：${response.status}`);
  }
  return (await response.json()) as Topology<T>;
}

export function topologyFeatures<P extends GeoJsonProperties>(
  topology: Topology<Objects>,
): FeatureCollection<Geometry, P> {
  const object = topology.objects[Object.keys(topology.objects)[0]];
  return feature(topology, object) as unknown as FeatureCollection<Geometry, P>;
}

// 將圖徵投影成可直接塞進 <path d> 的字串，留 18px 邊界避免描邊被裁切
export function mapPaths<P extends GeoJsonProperties>(
  features: FeatureCollection<Geometry, P>,
  width: number,
  height: number,
) {
  const projection = geoMercator().fitExtent(
    [
      [18, 18],
      [width - 18, height - 18],
    ],
    features,
  );
  const path = geoPath(projection);
  return features.features.map((item) => ({
    feature: item,
    path: path(item) ?? "",
  }));
}

// 金門、連江離本島太遠，等比例投影會把本島壓得很小；改成本島＋澎湖填滿畫面，兩個離島各自投影進左上角的小框。
// 投影以固定經緯度範圍對齊而非圖徵範圍：高雄市含東沙、南沙太平島，金門縣含烏坵，用圖徵範圍會被這些遠方小島撐大。
// 範圍外的部分以 clipExtent 裁掉，避免畫進其他區塊。
type Bounds = [[number, number], [number, number]]; // [[西, 南], [東, 北]]
const mainBounds: Bounds = [
  [119.3, 21.85],
  [122.1, 25.35],
];
const insets: Array<{ name: string; bounds: Bounds }> = [
  {
    name: "金門縣",
    bounds: [
      [118.2, 24.37],
      [118.52, 24.54],
    ],
  },
  {
    name: "連江縣",
    bounds: [
      [119.88, 25.93],
      [120.52, 26.4],
    ],
  },
];
const insetBox = { width: 112, height: 92, gap: 10, margin: 12 };

function boundedPath(bounds: Bounds, extent: Bounds) {
  const projection = geoMercator()
    .fitExtent(extent, { type: "MultiPoint", coordinates: bounds })
    .clipExtent(extent);
  return geoPath(projection);
}

export function countyPathsWithInsets(
  counties: FeatureCollection<Geometry, CountyProperties>,
  width: number,
  height: number,
) {
  const insetNames = insets.map((inset) => inset.name);
  const mainPath = boundedPath(mainBounds, [
    [18, 18],
    [width - 18, height - 18],
  ]);
  const main = counties.features
    .filter((item) => !insetNames.includes(item.properties.COUNTYNAME))
    .map((item) => ({ feature: item, path: mainPath(item) ?? "" }));

  const insetPaths = insets.flatMap(({ name, bounds }, index) => {
    const item = counties.features.find(
      (county) => county.properties.COUNTYNAME === name,
    );
    if (!item) {
      return [];
    }
    const box = {
      x: insetBox.margin,
      y: insetBox.margin + index * (insetBox.height + insetBox.gap),
      width: insetBox.width,
      height: insetBox.height,
    };
    // 上方留 20px 給框內的縣市名稱
    const path = boundedPath(bounds, [
      [box.x + 6, box.y + 20],
      [box.x + box.width - 6, box.y + box.height - 6],
    ]);
    return [{ feature: item, path: path(item) ?? "", box }];
  });
  return { main, insets: insetPaths };
}
