# Kenney Asset Plan for SentinelTwin

**Date:** 2026-05-27
**Scope:** research only, no implementation
**Source bundle:** `/Users/pranay/Projects/adhoc_resources/game_assets/Kenney Game Assets All-in-1 3.4.0/`

## Goal

Use the paid Kenney all-in-one bundle as a professional-looking visual base for SentinelTwin without making the product feel like a kids or platformer game.

The rule is:
- simulation geometry stays accurate and simple
- decorative meshes / textures provide polish
- art direction stays restrained and security-product-like

## Packs that fit SentinelTwin best

### Primary 3D packs

- `3D assets/City Kit - Industrial`
- `3D assets/City Kit - Commercial`
- `3D assets/City Kit - Suburban`
- `3D assets/Building Kit`
- `3D assets/Modular Buildings`
- `3D assets/Furniture Kit`
- `3D assets/Prototype Kit`
- `3D assets/Mini Market`
- `3D assets/Road Pack`
- `3D assets/City Kit - Roads`

### Primary 2D packs

- `2D assets/Prototype Textures`
- `2D assets/Road Textures`
- `2D assets/Pattern Pack`
- `2D assets/Brick Pack`
- `2D assets/Development Essentials`
- `2D assets/Roguelike Interior Pack`
- `2D assets/Isometric Modular Buildings`
- `2D assets/Isometric Tiles Buildings`
- `2D assets/Isometric Tiles City`

## Actual file-name signals that matter

### Building Kit

Good signs for SentinelTwin:
- `wall.png`
- `floor.png`
- `floor-half.png`
- `wall-corner.png`
- `wall-corner-round.png`
- `wall-doorway-square.png`
- `wall-doorway-wide-square.png`
- `wall-doorway-round.png`
- `wall-window-square.png`
- `wall-window-wide-square.png`
- `wall-window-round.png`
- `door-rotate-square-a/b/c/d.png`
- `door-rotate-round-a/b/c/d.png`
- `column.png`
- `column-thin.png`
- `border.png`
- `border-corner.png`
- `plating.png`
- `roof-flat-*`
- `stairs-*`

Why this pack matters:
- It has the right semantic building blocks for walls, doors, windows, corners, floors, columns, and structural trims.
- It looks like a modular architectural kit, not a playful toy set.

### Furniture Kit

Good signs for SentinelTwin:
- `desk_SE.png`
- `deskCorner_SW.png`
- `table.png`
- `tableRound.png`
- `tableCoffee*.png`
- `chair*.png`
- `bookcaseOpen*.png`
- `bookcaseClosed*.png`
- `lampWall*.png`
- `lampSquareFloor*.png`
- `lampSquareCeiling*.png`
- `loungeChair*.png`
- `loungeDesignSofa*.png`
- `cabinetTelevision*.png`
- `speaker*.png`
- `trashcan*.png`

Why this pack matters:
- It can furnish offices, lobbies, control rooms, reception spaces, and retail-like interiors.
- It has the exact types of props SentinelTwin needs for counters, desks, seating, and storage.

### City Kit - Industrial

Good signs for SentinelTwin:
- industrial building variants in the preview set
- chimney / tank / structure pieces
- low-detail building silhouettes

Why this pack matters:
- Great for exterior shells, service areas, warehouses, loading zones, and industrial site context.
- Can support perimeter / facility-scale scenes without looking cartoonish if materials are restrained.

### City Kit - Commercial

Good signs for SentinelTwin:
- low-detail building variants
- awnings / overhangs / parasol pieces
- storefront-like massing

Why this pack matters:
- Best for retail, office-front, lobby-exterior, and generic commercial frontage scenes.
- Use for entrances, canopies, and outward-facing architecture.

### Prototype Textures

Good signs for SentinelTwin:
- generic prototype texture set
- vector/surface patterns suitable for blocked-in materials

Why this pack matters:
- Useful as a professional placeholder texture base while the product art direction is still stabilizing.
- Good for floor/wall differentiation, paneling, and simple contrast surfaces.

### Road Textures

Good signs for SentinelTwin:
- road / pavement / lane / surface tile textures

Why this pack matters:
- Useful for parking, drive-up, perimeter, loading, and exterior approach contexts.
- Also useful as a general ground-surface texture source.

## What should be used for what

### SentinelTwin scene nouns -> Kenney source

- `wall` -> Building Kit + optional Prototype Textures
- `floor` -> Building Kit + Prototype Textures
- `door` -> Building Kit door variants
- `window` -> Building Kit window variants
- `column` -> Building Kit column / thin column
- `desk` -> Furniture Kit
- `table` -> Furniture Kit
- `chair` -> Furniture Kit
- `shelf / bookcase` -> Furniture Kit bookcase variants
- `counter / reception / workstation` -> Furniture Kit desk / table / cabinet combinations
- `light` -> Furniture Kit lamp variants
- `obstruction` -> Furniture Kit storage / box / cabinet-like props, or Building Kit massing where needed
- `industrial shell` -> City Kit - Industrial
- `commercial shell` -> City Kit - Commercial
- `perimeter / road / exterior approach` -> Road Pack + Road Textures
- `panel / trim / placeholder surface` -> Prototype Textures

## What to avoid

Avoid making SentinelTwin look like:
- a platformer
- a fantasy game
- a roguelike dungeon
- a collectible toy set
- a bright casual game HUD

Avoid these families for core SentinelTwin visuals:
- Platformer packs
- Fantasy / dungeon packs
- cute character packs
- collectible / arcade / holiday packs

## Recommended art-direction rules

- keep a muted palette
- use matte concrete, brushed metal, neutral glass, and subdued wood
- limit decorative materials to a few consistent categories
- keep collider geometry separate from decorative meshes
- prioritize clean silhouettes over busy detail
- keep camera, light, door, window, and obstruction forms semantically obvious
- avoid obvious game-like saturation or exaggerated proportions

## What can be done next from this research

1. Build a SentinelTwin asset registry that maps semantic objects to this bundle.
2. Pick one or two packs as the default source of truth for interior props.
3. Use Building Kit as the structural base and Furniture Kit for readable interior dressing.
4. Use City Kit - Commercial / Industrial only where the scene needs exterior or site context.
5. Use Prototype Textures and Road Textures to make the scene feel materially grounded.
6. Keep the sim logic unchanged while swapping decorative meshes and surface textures.

## Bottom line

Kenney absolutely can work here, but the professional look comes from choosing the right packs and constraining the material system.

The best fit for SentinelTwin is not "cute game assets everywhere".
It is:
- structural modular architecture from Building Kit
- readable props from Furniture Kit
- commercial / industrial shell pieces where needed
- restrained textures for floors, walls, and surfaces
