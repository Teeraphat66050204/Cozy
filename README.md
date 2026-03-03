# Cozy Polaroid Wall (Railway)

เว็บกำแพงรูปโพลารอยด์ที่อัปโหลดรูปแล้วทุกคนเห็นร่วมกัน โดย deploy บน Railway

## Stack

- Python + Gradio
- Railway Web Service
- Railway Volume (เก็บข้อมูลถาวร)

## Files

- `app.py` แอปหลัก
- `requirements.txt` dependencies
- `index.html` ไฟล์เวอร์ชัน static เดิม (ไม่ได้ใช้ใน Railway)

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

เปิด `http://localhost:7860`

## Deploy on Railway

1. Push โค้ดขึ้น GitHub repo
2. เข้า Railway แล้วกด `New Project` -> `Deploy from GitHub repo`
3. เลือก repo นี้
4. ไปที่ service ของโปรเจกต์ แล้วตั้งค่า `Variables`
- `DATA_DIR=/data`
5. ไปที่แท็บ `Volumes` แล้วสร้าง Volume ใหม่
6. Mount Volume ที่ path: `/data`
7. กด Redeploy

Railway จะใส่ `PORT` ให้เอง และแอปนี้รองรับแล้ว

## Notes

- ถ้าไม่ mount volume ข้อมูลรูปจะหายเมื่อมีการ redeploy/restart
- ปุ่ม `Clear all` จะลบรูปทั้งหมดจาก shared wall
