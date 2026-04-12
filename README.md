# ML Format Calculator

ML Format Calculator is a small TypeScript web app for inspecting and converting machine-learning numeric formats.
It is built as a format inspector, not just a plain converter: the UI shows raw bits, decoded values, field breakdowns, rounding behavior, and special-value categories side by side.

## Live Site

GitHub Pages URL:

`https://lapore.github.io/ml-format-calculator/`

## Current Status

The project is already usable locally.

- working browser UI powered by Vite
- working core engine for parsing, decoding, encoding, and conversion
- implemented formats in the UI: `FP32`, `FP16`, `BF16`, `E5M2`, `E4M3`, `E2M1`, `INT32`
- test coverage for format definitions, decode, encode, and end-to-end conversion
- GitHub Pages deployment configured through GitHub Actions

## What The App Does Today

- convert between `FP32`, `FP16`, `BF16`, `E5M2`, `E4M3`, `E2M1`, and `INT32`
- accept input as `decimal`, `hex`, or `binary`
- support rounding modes `RNE` and `RTZ`
- support `NaN` conversion policies: `preserve` and `canonical`
- show source and target values side by side
- show binary and hex bit patterns
- group bits visually into sign, exponent, and mantissa chunks
- show sign, exponent bits, mantissa bits, bias, stored exponent, and actual exponent
- classify values as `ZERO`, `SUBNORMAL`, `NORMAL`, `INF`, `NAN`, `INTEGER`, or `UNREPRESENTABLE`
- distinguish `qNaN` and `sNaN` for the IEEE-style formats that expose that distinction
- show per-stage conversion reports:
  - `Input -> Source`
  - `Source -> Target`
- show expandable equation/explanation blocks under each result panel
- provide presets for common values, boundaries, infinities, and NaNs

## Implemented Format Profiles

| Format | Status | Notes |
| --- | --- | --- |
| `FP32` | implemented | IEEE `binary32` style behavior |
| `FP16` | implemented | IEEE `binary16` style behavior |
| `BF16` | implemented | IEEE-like software `bfloat16` profile used by this calculator |
| `E5M2` | implemented | OCP FP8 `E5M2` profile with SAT overflow behavior |
| `E4M3` | implemented | OCP FP8 `E4M3` profile with SAT overflow behavior |
| `E2M1` | implemented | OCP MX FP4 `E2M1` profile with SAT overflow behavior |
| `INT32` | implemented | signed two's-complement integer |

### IEEE Float Coverage

For `FP32`, `FP16`, and the calculator's current `BF16` profile, the engine accounts for:

- `+0` and `-0`
- subnormal values
- normal values
- `+inf` and `-inf`
- `qNaN` and `sNaN`
- named boundaries such as `MIN_SUBNORMAL`, `MAX_SUBNORMAL`, `MIN_NORMAL`, and `MAX_NORMAL`

### OCP Float Coverage

For the implemented OCP profiles, the engine accounts for:

- `E5M2`
  - signed zero
  - subnormals
  - normals
  - infinities
  - NaNs without a quiet/signaling distinction
  - named boundaries such as `MIN_SUBNORMAL`, `MAX_SUBNORMAL`, `MIN_NORMAL`, and `MAX_NORMAL`
- `E4M3`
  - signed zero
  - subnormals
  - normals
  - a single reserved NaN encoding
  - no infinity encoding
  - named boundaries such as `MIN_SUBNORMAL`, `MAX_SUBNORMAL`, `MIN_NORMAL`, and `MAX_NORMAL`
- `E2M1`
  - signed zero
  - subnormals
  - normals
  - no NaN or infinity encodings
  - named boundaries such as `MIN_SUBNORMAL`, `MAX_SUBNORMAL`, `MIN_NORMAL`, and `MAX_NORMAL`

For `INT32`, the engine accounts for:

- `ZERO`
- signed integer values
- `MIN_VALUE`
- `MAX_VALUE`
- unrepresentable float-to-int special cases such as `NaN` and `inf`

## Conversion Semantics

### Decimal Input

Decimal input is treated as a mathematical value, not as already-encoded source bits.

The path is:

1. parse decimal input
2. encode into the selected source format
3. decode the source representation for the left panel
4. encode into the target format
5. decode the target representation for the right panel

Rounding applies to every lossy encode step in this path.

### Hex And Binary Input

Hex and binary input are treated as exact raw bit patterns for the selected source format.

The path is:

1. parse raw bits
2. decode source exactly
3. encode into the target format
4. decode target for display

In this path, there is no input-to-source rounding step.

### Input Validation

Current validation behavior:

- binary and hex input must match the exact source-format width
- decimal mode accepts decimal syntax only
- decimal mode rejects empty input
- decimal mode rejects overflowed decimal literals such as `1e9999`
- decimal mode accepts `nan`, `inf`, and `-inf`
- decimal mode rejects `+nan` and `-nan`

If you want exact NaN payloads, NaN sign bits, or exact raw special encodings, use hex or binary input instead of decimal mode.

### NaN Policy

The UI exposes a `NaN policy` switch for float-to-float NaN conversions.

- `preserve`
  Preserve `qNaN` vs `sNaN` when possible and keep as much payload information as will fit in the target format.
- `canonical`
  Replace the target NaN with the calculator's default canonical NaN for that format.

Current canonical NaN values:

- `FP32`: `0x7fc00000`
- `BF16`: `0x7fc0`
- `FP16`: `0x7e00`
- `E5M2`: `0x7d`
- `E4M3`: `0x7f`

The default policy is `canonical`, and the switch can be used to opt into `preserve`.

When `canonical` is selected, the UI also shows a `Canonical NaN` input for the target format.

- it starts with the format's default canonical NaN value
- you can override it with another valid NaN bit pattern for the target format
- the override must match the target width exactly and must still decode to `NaN`

## BF16 Note

`BF16` is modeled here as an IEEE-like software profile:

- `1` sign bit
- `8` exponent bits
- `7` mantissa bits
- bias `127`
- signed zero
- subnormals enabled
- infinities enabled
- NaNs enabled
- `qNaN` and `sNaN` distinguished by the top mantissa bit

This is a deliberate project choice for the calculator.
Real hardware or framework behavior may differ.

## OCP Format Notes

The implemented OCP profiles intentionally follow the OCP-defined encoding tables and use a SAT-oriented
conversion profile in this calculator:

- `E5M2`
  - follows the OCP FP8 `E5M2` encoding table
  - raw bit patterns can represent `±inf`
  - raw bit patterns can represent `NaN`
  - `NaN` does not distinguish `qNaN` vs `sNaN`
  - decimal and cross-format overflow in this calculator use saturation to the maximum finite magnitude
- `E4M3`
  - follows the OCP FP8 `E4M3` encoding table
  - there is no infinity encoding
  - only the single `S 1111 111` pattern is treated as `NaN`
  - other all-ones exponent patterns remain finite normal numbers
  - decimal and cross-format overflow in this calculator use saturation to the maximum finite magnitude
- `E2M1`
  - follows the OCP MX FP4 `E2M1` encoding table
  - there are no `NaN` or infinity encodings
  - decimal and cross-format overflow in this calculator use saturation to the maximum finite magnitude
  - `NaN` conversion into `E2M1` is treated as unrepresentable by this calculator

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Vite will print the local URL in the terminal.

Run tests:

```bash
npm test
```

Type-check the project:

```bash
npm run typecheck
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

The production build is configured for GitHub Pages deployment under `/ml-format-calculator/`.

## GitHub Pages Deployment

This repo is set up to deploy automatically to GitHub Pages with GitHub Actions.

Public URL:

`https://lapore.github.io/ml-format-calculator/`

To enable it on GitHub:

1. Open the repository on GitHub.
2. Go to `Settings -> Pages`.
3. Under `Build and deployment`, choose `GitHub Actions`.
4. Make sure the repository is public if you are using GitHub Free for Pages hosting.
5. Push to `main`. The workflow in `.github/workflows/deploy.yml` will build and deploy the site.

The workflow runs:

- `npm ci`
- `npm test`
- `npm run typecheck`
- `npm run build`

## Project Structure

```text
ml-format-calculator/
  index.html
  package.json
  tsconfig.json
  src/
    adapter/
      engine-api.ts
    core/
      constants/
      convert/
      decode/
      encode/
      formats/
      model/
      parse/
      utils/
    ui/
      main.ts
      styles.css
  tests/
    convert/
    decode/
    encode/
    formats/
    ui/
```

### Main Layers

- `src/core`
  Pure engine logic: format definitions, parsing, decoding, encoding, and conversion.
- `src/adapter`
  Thin typed entry point for the UI.
- `src/ui`
  Browser UI, layout, rendering, presets, and explanations.

## Test Coverage

The current test suite covers:

- format-definition validation
- decode behavior
- encode behavior
- end-to-end conversion behavior
- exhaustive finite round-trip checks for `FP16`, `BF16`, `E5M2`, `E4M3`, and `E2M1`
- signed `RNE` and `RTZ` boundary-transition coverage around `MIN_SUBNORMAL`, the `MAX_SUBNORMAL` to `MIN_NORMAL` transition, and `MAX_NORMAL`
- raw input validation
- NaN and infinity handling
- OCP-specific saturation, NaN, and finite-only corner cases
- rounding behavior for `RNE` and `RTZ`
- unrepresentable target cases such as float special values to `INT32`
- UI render-path coverage for subtitle text, stage cards, result panels, format-specific NaN explanations, and escaped status/error messages

## Known Gaps

- cross-format NaN conversions may change payload width when moving into a narrower destination format
- the current UI is intentionally minimal and focused on correctness over polish

## Next Likely Steps

- add more OCP-linked preset coverage and UI polish for the new small formats
- decide whether to expose alternate OCP overflow profiles beyond the current SAT-oriented implementation
- improve UI polish once the supported-format set is larger
- add more spec-linked test vectors as new formats land
