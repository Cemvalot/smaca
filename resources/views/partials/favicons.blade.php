@php
  $smacaFaviconBust = '1';
  foreach ([base_path('assets/brand/favicon.ico'), public_path('favicon.ico'), public_path('assets/brand/favicon.ico')] as $smacaIcoPath) {
    if (is_string($smacaIcoPath) && is_file($smacaIcoPath)) {
      $smacaFaviconBust = (string) @filemtime($smacaIcoPath);
      break;
    }
  }
@endphp
{{-- Ίδιο layout παντού· αν βλέπεις Laravel icon: cache καρτέλας / παλιό 404 — ?v= αναγκάζει refresh. /favicon.ico = symlink ή route web.php. --}}
<link rel="icon" href="{{ asset('favicon.ico') }}?v={{ $smacaFaviconBust }}" sizes="any" type="image/x-icon">
<link rel="icon" href="{{ asset('assets/brand/favicon.ico') }}?v={{ $smacaFaviconBust }}" sizes="any" type="image/x-icon">
<link rel="icon" type="image/png" sizes="32x32" href="{{ asset('assets/brand/smaca-favicon-32.png') }}?v={{ $smacaFaviconBust }}">
<link rel="icon" type="image/svg+xml" href="{{ asset('assets/brand/smaca-favicon.svg') }}?v={{ $smacaFaviconBust }}">
<link rel="apple-touch-icon" sizes="180x180" href="{{ asset('assets/brand/smaca-favicon-180.png') }}?v={{ $smacaFaviconBust }}">
