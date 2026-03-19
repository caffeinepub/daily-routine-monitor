# Interval Bell Timer

## Current State
The BellTimerPage uses hardcoded Web Audio API tones for three bells:
- Bell 1 (end of work): single C5 sine tone
- Bell 2 (end of rest): double G5 sine tone
- Bell 3 (completion): ascending C5-E5-G5 chime

Settings panel allows configuring cycles, work duration, rest duration only.

## Requested Changes (Diff)

### Add
- Tone picker for each of the 3 bells: choices are "Soft Chime", "Sharp Bell", "Deep Gong"
- Volume slider (0–100%) shared across all bells
- Preview button next to each bell tone picker to audition the tone
- Tone/volume settings stored in component state and applied at playback time

### Modify
- SettingsPanel: add tone pickers and volume control
- playBell1/2/3 functions: accept tone type and volume parameters

### Remove
- Nothing removed

## Implementation Plan
1. Extend audio functions to accept `toneType` (soft-chime | sharp-bell | deep-gong) and `volume` (0–1)
2. Implement each tone variant using Web Audio API (different waveforms/frequencies)
3. Add tone state vars (bell1Tone, bell2Tone, bell3Tone, volume) to BellTimerPage
4. Extend SettingsPanel props and UI to include tone pickers and volume slider
5. Add preview buttons that play the selected tone immediately
