String formatDuration(Duration duration, {bool alwaysShowHours = true}) {
  final hours = duration.inHours;
  final minutes = duration.inMinutes.remainder(60);
  final seconds = duration.inSeconds.remainder(60);
  final minuteText = minutes.toString().padLeft(2, '0');
  final secondText = seconds.toString().padLeft(2, '0');

  if (!alwaysShowHours && hours == 0) {
    return '$minuteText:$secondText';
  }

  return '${hours.toString().padLeft(2, '0')}:$minuteText:$secondText';
}
