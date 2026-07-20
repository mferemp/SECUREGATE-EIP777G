// authGateSweep.ts (S05) — the two Auth-Gate sweep modes (honest placeholders).
//
// Owner rules:
//   * SCAN         = a SAME-DEVICE sweep (the device you are on).
//   * LINK DEVICE  = a USB-LINKED-DEVICE sweep (a separate hardware device).
// Both are non-faked placeholders: they describe intent, record an attempt, and
// return a result that NEVER claims verification and NEVER unlocks execution.
// (Reuses the honesty invariants proven by verify-placeholder-gates.cjs — this
// module adds the sweep-mode semantics on top.)

export type SweepMode = 'scan' | 'link'

export type SweepDescriptor = {
  mode: SweepMode
  deviceScope: 'same-device' | 'usb-linked-device'
  label: string
  // Honest invariants — always false for a placeholder sweep.
  verified: false
  unlocksExecution: false
}

export const SWEEP_DESCRIPTORS: Record<SweepMode, SweepDescriptor> = {
  scan: {
    mode: 'scan',
    deviceScope: 'same-device',
    label: 'SCAN — check the wallet on this device',
    verified: false,
    unlocksExecution: false,
  },
  link: {
    mode: 'link',
    deviceScope: 'usb-linked-device',
    label: 'LINK DEVICE — check a USB-linked hardware device',
    verified: false,
    unlocksExecution: false,
  },
}

export function describeSweep(mode: SweepMode): SweepDescriptor {
  return SWEEP_DESCRIPTORS[mode]
}

export function isSameDeviceSweep(mode: SweepMode): boolean {
  return SWEEP_DESCRIPTORS[mode].deviceScope === 'same-device'
}

export function isLinkedDeviceSweep(mode: SweepMode): boolean {
  return SWEEP_DESCRIPTORS[mode].deviceScope === 'usb-linked-device'
}
