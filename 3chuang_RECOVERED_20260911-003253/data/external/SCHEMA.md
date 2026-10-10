# PORTCUBE External Cargo Schema 1.0

Normalized records preserve source values under `sourceFields` and use `null`, `UNKNOWN`, or `NOT_PROVIDED` for unavailable facts. Dimensions are normalized to millimetres and mass to kilograms only when the source unit is explicit. Pressure and strength fields are never treated as total supported weight without a verified conversion.

Required adapter fields: `externalSource`, `externalDataset`, `externalInstance`, `externalItemId`, `name`, `packagingType`, `lengthMm`, `widthMm`, `heightMm`, `weightKg`, `quantity`, `orientationConstraints`, `stackability`, `maxStackLayers`, `loadBearing`, `loadBearingUnit`, `loadBearingSourceDefinition`, `alwaysOnTop`, `alwaysOnBottom`, `stackingGroup`, `hazardous`, `palletAttached`, `destination`, `deliveryStage`, `geometryType`, `geometryAsset`, `boundingBox`, `sourceGeometryMetadata`, `containerDefinition`, `sourceFields`, and `unknownFields`.

`geometryType` uses `BOX`, `MESH`, or another explicit geometry family. A mesh `boundingBox` remains in source coordinates with `originalUnit: NOT_PROVIDED` until a canonical unit is verified; it is not copied into PORTCUBE millimetre solver dimensions.

ORTEC `deliveryDay` remains in `sourceFields` and is not treated as a sea-port unload sequence. ORTEC layer limits remain part of the referenced layer definition and are not treated as item-level `maxStackLayers`. Pairwise `stackingGroup`, `alwaysOnTop`, `alwaysOnBottom`, and full axis permissions are losslessly retained but are marked as pending solver support in the task-copy presentation layer.

Raw files are immutable provenance inputs. All cleaning and transformation outputs are written under `data/external/normalized`.
