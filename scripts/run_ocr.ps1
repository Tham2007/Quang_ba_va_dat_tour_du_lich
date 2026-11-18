Add-Type -AssemblyName System.Drawing
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null

$imgPath = (Resolve-Path 'C:/Users/ACER/.gemini/antigravity/brain/e22ea4a5-6679-44c1-8a3a-0436df72940c/.user_uploaded/media_1794805658353_4875870a.jpg').Path
$file = [Windows.Storage.StorageFile]::GetFileFromPathAsync($imgPath).GetAwaiter().GetResult()
$stream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read).GetAwaiter().GetResult()
$decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).GetAwaiter().GetResult()
$bitmap = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("en-US"))
}
$res = $engine.RecognizeAsync($bitmap).GetAwaiter().GetResult()
Write-Host '=== OCR LINES ==='
foreach ($l in $res.Lines) {
    Write-Host "$($l.Text)"
}
