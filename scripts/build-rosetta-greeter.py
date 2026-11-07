"""Tạo ứng viên Rosetta từ bản render gốc; kiểm tra trước khi đưa file xuất vào thư mục public."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('restore-rosetta-render.py')),run_name='__main__')
