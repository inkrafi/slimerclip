import os
import urllib.request
import zipfile
import shutil
import subprocess
import sys

FFMPEG_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
BIN_DIR = os.path.join(os.path.dirname(__file__), "bin")
ZIP_PATH = os.path.join(BIN_DIR, "ffmpeg.zip")

def is_ffmpeg_installed():
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except FileNotFoundError:
        # Periksa juga apakah ada di folder bin lokal
        ffmpeg_exe = os.path.join(BIN_DIR, "ffmpeg", "bin", "ffmpeg.exe")
        return os.path.exists(ffmpeg_exe)

def download_with_progress(url, dest):
    print(f"Mengunduh FFmpeg dari {url}...")
    def reporthook(blocknum, blocksize, totalsize):
        readsofar = blocknum * blocksize
        if totalsize > 0:
            percent = readsofar * 1e2 / totalsize
            s = "\r%5.1f%% %*d / %d" % (
                percent, len(str(totalsize)), readsofar, totalsize)
            sys.stdout.write(s)
            if readsofar >= totalsize: # near the end
                sys.stdout.write("\n")
        else: # total size is unknown
            sys.stdout.write("read %d\n" % (readsofar,))

    urllib.request.urlretrieve(url, dest, reporthook)
    print("Selesai mengunduh.")

def setup_ffmpeg():
    if is_ffmpeg_installed():
        print("FFmpeg sudah terinstal dan tersedia.")
        return

    os.makedirs(BIN_DIR, exist_ok=True)
    
    # 1. Download
    print("FFmpeg belum terinstal. Memulai proses download...")
    download_with_progress(FFMPEG_URL, ZIP_PATH)
    
    # 2. Ekstrak
    print("Mengekstrak FFmpeg...")
    with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
        zip_ref.extractall(BIN_DIR)
        
    # 3. Pindahkan folder (rename folder ekstraksi yang panjang)
    extracted_dirs = [d for d in os.listdir(BIN_DIR) if os.path.isdir(os.path.join(BIN_DIR, d))]
    ffmpeg_dir = None
    for d in extracted_dirs:
        if d.startswith("ffmpeg-") and not d == "ffmpeg":
            ffmpeg_dir = os.path.join(BIN_DIR, d)
            break
            
    if ffmpeg_dir:
        target_dir = os.path.join(BIN_DIR, "ffmpeg")
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)
        os.rename(ffmpeg_dir, target_dir)
        print(f"FFmpeg berhasil diekstrak ke {target_dir}")
        
    # 4. Cleanup
    os.remove(ZIP_PATH)
    
    ffmpeg_exe_path = os.path.abspath(os.path.join(BIN_DIR, "ffmpeg", "bin", "ffmpeg.exe"))
    print(f"Setup selesai. FFmpeg tersedia di: {ffmpeg_exe_path}")
    print("Aplikasi backend akan otomatis menambahkan ini ke PATH saat runtime.")

if __name__ == "__main__":
    setup_ffmpeg()
