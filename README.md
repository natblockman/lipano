# lipano

เปียโนออนไลน์เต็มช่วงมาตรฐาน 88 คีย์ (A0–C8) ที่เล่นได้ด้วยคีย์บอร์ด เมาส์ และหน้าจอสัมผัส เสียงทั้งหมดสร้างด้วย Web Audio API ภายในเบราว์เซอร์ จึงไม่ต้องดาวน์โหลดไฟล์เสียงหรือติดตั้งแพ็กเกจเพิ่มเติม

โอเพนซอร์สภายใต้ MIT License ใช้งาน แก้ไข และแจกจ่ายได้ฟรี

## Windows 10/11

1. ไปที่หน้า [Releases](../../releases/latest)
2. ดาวน์โหลด `lipano.exe`
3. ดับเบิลคลิกเพื่อเปิดโปรแกรม

ไฟล์ `.exe` ใช้ Microsoft Edge หรือ Google Chrome ที่มีอยู่ในเครื่องและไม่ต้องติดตั้ง Python เนื่องจากไฟล์ยังไม่ได้ลงลายเซ็นดิจิทัล Windows อาจแสดงคำเตือนผู้เผยแพร่ที่ไม่รู้จักในครั้งแรก

นักพัฒนาที่มี Python 3 สามารถโคลนรีโปแล้วเปิด `run-windows.bat` ได้โดยไม่ต้องสร้างไฟล์ `.exe`

## ติดตั้งเป็นโปรแกรมบน Linux

```bash
./install.sh
```

หลังติดตั้ง ค้นหา **lipano** จากเมนูแอป หรือเรียกด้วยคำสั่ง `lipano` โปรแกรมจะเปิดเป็นหน้าต่างเดสก์ท็อปโดยไม่ต้องเปิดเว็บเซิร์ฟเวอร์เอง

รองรับ Microsoft Edge, Google Chrome และ Chromium การถอนการติดตั้งทำได้ด้วย `./uninstall.sh`

## เปิดเป็นเว็บ

เปิดไฟล์ `index.html` โดยตรง หรือเปิดผ่านเว็บเซิร์ฟเวอร์ขนาดเล็ก:

```bash
python3 -m http.server 4173
```

จากนั้นไปที่ `http://localhost:4173`

## วิธีเล่น

- คีย์ขาว: `A S D F G H J K L`
- คีย์ดำ: `W E T Y U O P`
- ค้างเสียง: `Space`
- เปลี่ยนอ็อกเทฟ: `↑` / `↓`
- เริ่มหรือหยุดบันทึก: `R`

ตัวควบคุมบนหน้าจอรองรับการเปลี่ยนเสียง ปรับระดับเสียง เลื่อนอ็อกเทฟ เปิด sustain บันทึก และเล่นผลงานซ้ำ

กด **ตั้งค่าปุ่ม** ใต้แป้นเปียโนเพื่อเปลี่ยนคีย์ของโน้ต, Sustain, การเลื่อนอ็อกเทฟ และการบันทึก ค่าที่เลือกจะถูกจดจำไว้สำหรับการเปิดโปรแกรมครั้งถัดไป

เมโทรนอมรองรับความเร็ว 40–220 BPM, จังหวะ 2/4, 3/4, 4/4 และ 6/8 พร้อม Tap Tempo และเสียงเน้นจังหวะแรก กด `M` เพื่อเปิดหรือปิดได้ และสามารถเปลี่ยนปุ่มนี้จากหน้าตั้งค่าปุ่ม

## สร้างไฟล์ Windows ด้วยตนเอง

```powershell
py -m pip install "pyinstaller>=6.11,<7"
pyinstaller --noconfirm --clean lipano.spec
```

ไฟล์ที่สร้างจะอยู่ที่ `dist\lipano.exe` นอกจากนี้ GitHub Actions จะสร้าง artifact ทุกครั้งที่ push และสร้าง Release พร้อมไฟล์ดาวน์โหลดอัตโนมัติเมื่อ push แท็กที่ขึ้นต้นด้วย `v`

## English

**lipano** is a free, open-source 88-key digital piano for Windows, Linux, and the web. It includes customizable keyboard bindings, recording/playback, sustain, four synthesized sounds, octave controls, and a metronome with tap tempo. Windows users can download the standalone `lipano.exe` from Releases; Linux users can run `./install.sh`.

## License

[MIT](LICENSE)
