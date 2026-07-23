'use client';

import { ProjectService } from '@/lib/project';
import {
  serializeProject,
  deserializeProject,
} from '@/lib/project/io';
export default function TestPage() {
  const handleClick = () => {
  const project = ProjectService.createNewProject('Gaivota');

  const json = serializeProject(project);

  console.clear();

  console.log('🚀🚀🚀 SONCEIBE FUNCIONA 🚀🚀🚀');
  console.log(project);

  console.log('🔥 JSON GENERADO 🔥');
  console.log(json);

  const restored = deserializeProject(json);

  console.log('✅ PROYECTO RESTAURADO');
  console.log(restored);
};

  return (
    <main
      style={{
        padding: 40,
        fontFamily: 'Arial',
      }}
    >
      <h1>SonCeibe Studio - Test</h1>

      <button
        onClick={handleClick}
        style={{
          padding: '12px 20px',
          fontSize: 18,
          cursor: 'pointer',
        }}
      >
        Crear proyecto de prueba
      </button>
    </main>
  );
}