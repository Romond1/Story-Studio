import type { SavedAudioDevice } from "./audioSettings";

export type AudioDeviceMenuOption = SavedAudioDevice & { missing?: boolean };

export function buildAudioDeviceMenuOptions(
  devices: SavedAudioDevice[],
  selected: SavedAudioDevice,
): AudioDeviceMenuOption[] {
  const options: AudioDeviceMenuOption[] = [
    { deviceId: "default", label: "System Default" },
    ...devices.filter((device) => device.deviceId !== "default"),
  ];
  if (selected.deviceId !== "default" && !options.some((option) => option.deviceId === selected.deviceId)) {
    options.splice(1, 0, {
      deviceId: selected.deviceId,
      label: `${selected.label} — Missing`,
      missing: true,
    });
  }
  return options;
}

export function selectAudioDeviceMenuOption(
  options: AudioDeviceMenuOption[],
  deviceId: string,
): SavedAudioDevice | null {
  const selected = options.find((option) => option.deviceId === deviceId);
  return selected ? { deviceId: selected.deviceId, label: selected.label.replace(/ — Missing$/, "") } : null;
}

export function getAudioDeviceSelectionLabel(
  selected: SavedAudioDevice,
  pending: SavedAudioDevice | null,
): string {
  return pending ? `Connecting: ${pending.label}` : selected.label;
}
