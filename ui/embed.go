package ui

import "embed"

// FS contains the embedded frontend files.
//
//go:embed all:static
var FS embed.FS
