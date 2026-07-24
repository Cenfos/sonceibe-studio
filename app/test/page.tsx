'use client';

import {
  getCurrentProject,
  setCurrentProject,
} from '@/lib/project';
import { ProjectService } from '@/lib/project';
import {
  saveProject,
  openProject,
} from '@/lib/project/io';

export default function TestPage() {
  const handleCreate = () => {
    const project = ProjectService.createNewProject('Gaivota');

setCurrentProject(project);

console.log('Proyecto actual');

console.log(getCurrentProject());
  };

  const handleSave = () => {
    const project = ProjectService.createNewProject('Gaivota');

    saveProject(project);

    console.clear();
    console.log('💾 Proyecto guardado');
    console.log(project);
  };

  const handleOpen = async () => {
    const project = await openProject();

    console.clear();

    if (!project) {
      setCurrentProject(project);

console.log('Proyecto actual');

console.log(getCurrentProject());
      console.log('No se seleccionó ningún archivo.');
      return;
    }

    console.log('📂 Proyecto abierto');
    console.log(project);
  };

  return (
    <main
      style={{
        padding: 40,
        fontFamily: 'Arial',
      }}
    >
      <h1>SonCeibe Studio - Test</h1>

      <div
        style={{
          display: 'flex',
          gap: 20,
          marginTop: 30,
        }}
      >
        <button
          onClick={handleCreate}
          style={{
            padding: '12px 20px',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          Crear proyecto
        </button>

        <button
          onClick={handleSave}
          style={{
            padding: '12px 20px',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          Guardar proyecto (.scs)
        </button>

        <button
          onClick={handleOpen}
          style={{
            padding: '12px 20px',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          Abrir proyecto (.scs)
        </button>
      </div>
    </main>
  );
}