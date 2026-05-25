import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function RideScreen() {
  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText>Active ride — coming in Wave 4</ThemedText>
    </ThemedView>
  );
}
