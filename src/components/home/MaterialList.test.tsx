import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import type { StudyMaterial } from '@/types';

import { MaterialList } from './MaterialList';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

const materials: StudyMaterial[] = Array.from({ length: 5 }, (_, index) => ({
  id: `material-${index}`,
  projectId: 'folder',
  title: `자료 ${index + 1}`,
  source: {
    kind: 'audio',
    origin: 'recording',
    uri: `file://recording-${index}.m4a`,
    fileName: `recording-${index}.m4a`,
    mimeType: 'audio/mp4',
  },
  status: 'ready',
  progress: 1,
  progressLabel: '',
  syncStatus: 'synced',
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  transcript: [],
  quiz: [],
  markers: [],
}));

it.each([1, 2])('keeps single-column cards compact while preserving a %i-column layout', async (columns) => {
  await render(
    <MaterialList
      columns={columns}
      empty={<View />}
      evaluatingMaterialIds={[]}
      gutter={20}
      header={<View />}
      materials={materials}
      onMore={jest.fn()}
      onOpen={jest.fn()}
      processingMaterialIds={[]}
      projectById={new Map()}
      view="card"
      width={columns === 1 ? 375 : 768}
    />,
  );

  const compactThumbnails = screen.container.queryAll((node) => {
    const style = StyleSheet.flatten(node.props.style);
    return style?.height === 56 && style?.width === 56 && style?.aspectRatio === 1;
  });
  expect(compactThumbnails).toHaveLength(columns === 1 ? materials.length : 0);
});

it('keeps report status, opening and menu actions in compact card mode', async () => {
  const onOpen = jest.fn();
  const onMore = jest.fn();
  await render(
    <MaterialList
      columns={1}
      empty={<View />}
      evaluatingMaterialIds={['material-0']}
      gutter={20}
      header={<View />}
      materials={materials}
      onMore={onMore}
      onOpen={onOpen}
      processingMaterialIds={[]}
      projectById={new Map()}
      view="card"
      width={375}
    />,
  );

  expect(screen.getByText('평가 중')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /^자료 1,/ }));
  await fireEvent.press(screen.getByRole('button', { name: '자료 1 메뉴' }));

  expect(onOpen).toHaveBeenCalledWith(materials[0]);
  expect(onMore).toHaveBeenCalledWith(materials[0]);
});
