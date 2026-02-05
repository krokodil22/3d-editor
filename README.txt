# Mini 3D Editor — версия с CDN fallback

У тебя блокируется unpkg.com (examples/js), поэтому OrbitControls/TransformControls/STLExporter не грузились.

Эта версия:
- Сначала пробует core Three.js с cdnjs → jsdelivr → unpkg
- Addons пробует с jsdelivr → unpkg
- Если всё заблокировано сетью — покажет список URL, которые пыталась загрузить.

Запуск:
- локально: python -m http.server 8000 → http://localhost:8000
- на хостинге: просто залить файлы
