export type Point = [number, number];
export type Ring = Point[];
export type Polygon = Ring[]; // [exterior, ...holes]
export type MultiPolygon = Polygon[];
export type BBox = [number, number, number, number]; // minX, minY, maxX, maxY
