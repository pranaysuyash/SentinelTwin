# Annotation Spec for Floorplan -> SecurityScene Subset

## Goal

Provide adjudicated ground truth for evaluating extraction quality in the V0.2 bakeoff.

## Per-image annotation fields

- `image_id`
- `source_type` (`clean_digital`, `scan_photo`, `annotated_broker`)
- `scale_reference`
- `walls`: list of segments with endpoints in normalized coordinates
- `doors`: boxes/polygons + class labels
- `windows`: boxes/polygons + class labels
- `obstructions`: geometry + class in allowed subset
- `critical_zones`: polygons + zone type tags
- `notes`: ambiguities and annotation decisions

## Normalization

- Coordinates normalized to `[0,1]` in image space before mapping to metric scale.
- Include one known dimension when available for metric conversion.

## Review policy

- Two annotators minimum on test split.
- Conflicts resolved by adjudicator; store rationale in `notes`.

## Output format

Use JSON files under:
- `data/annotations/dev/`
- `data/annotations/validation/`
- `data/annotations/test/`
