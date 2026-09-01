import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useTheme } from '@/lib/theme-context';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, toggle, colors } = useTheme();

  if (compact) {
    return (
      <TouchableOpacity onPress={toggle} style={[styles.compactBtn, { backgroundColor: colors.inputBg }]}>
        {mode === 'light' ? <Moon color={colors.text} size={18} /> : <Sun color={colors.text} size={18} />}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={toggle}
      style={[styles.toggle, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
    >
      <View style={[styles.option, mode === 'light' && { backgroundColor: colors.cardBg }]}>
        <Sun color={mode === 'light' ? colors.accent : colors.subtext} size={16} />
        {mode === 'light' && <Text style={[styles.optionText, { color: colors.text }]}>فاتح</Text>}
      </View>
      <View style={[styles.option, mode === 'dark' && { backgroundColor: colors.cardBg }]}>
        <Moon color={mode === 'dark' ? colors.primary : colors.subtext} size={16} />
        {mode === 'dark' && <Text style={[styles.optionText, { color: colors.text }]}>داكن</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  compactBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionText: {
    fontFamily: 'Cairo-Medium',
    fontSize: 13,
  },
});
