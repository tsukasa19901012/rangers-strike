//! Rangers Strike save data for the PocketJS Vita host (injected by
//! apps/vita/scripts/patch-pocketjs-vita.mjs; not part of stock PocketJS).
//!
//! Installs `globalThis.rsStore` with string key/value files under
//! `ux0:data/rangers-strike/`:
//!   read(key) -> string | undefined, write(key, value) -> bool,
//!   remove(key) -> bool, keys() -> string (newline separated).
//! A write goes to `<key>.tmp` first and replaces the old file afterwards,
//! so a power-off mid-write keeps the previous save.

use std::fs;
use std::string::String;

use libquickjs_sys::*;

const DIR: &str = "ux0:data/rangers-strike";
const EXT: &str = ".json";

extern "C" {
    fn JS_NewStringLen(ctx: *mut JSContext, str1: *const u8, len1: usize) -> JSValue;
}

/// Keys come from the guest; allow only a safe file-name alphabet.
fn path_for(key: &str) -> Option<String> {
    let ok = !key.is_empty()
        && key.len() <= 64
        && key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'_' || b == b'-')
        && !key.starts_with('.');
    ok.then(|| format!("{DIR}/{key}{EXT}"))
}

unsafe fn arg_string(ctx: *mut JSContext, argc: i32, argv: *mut JSValue, i: i32) -> Option<String> {
    if argc <= i {
        return None;
    }
    let mut len: size_t = 0;
    let s = JS_ToCStringLen2(ctx, &mut len, *argv.offset(i as isize), 0);
    if s.is_null() {
        return None;
    }
    let out = String::from_utf8_lossy(core::slice::from_raw_parts(s as *const u8, len)).into_owned();
    JS_FreeCString(ctx, s);
    Some(out)
}

unsafe fn new_string(ctx: *mut JSContext, s: &str) -> JSValue {
    JS_NewStringLen(ctx, s.as_ptr(), s.len())
}

unsafe extern "C" fn js_read(ctx: *mut JSContext, _this: JSValue, argc: i32, argv: *mut JSValue) -> JSValue {
    let Some(path) = arg_string(ctx, argc, argv, 0).as_deref().and_then(path_for) else {
        return JS_UNDEFINED;
    };
    match fs::read(&path) {
        Ok(bytes) => new_string(ctx, &String::from_utf8_lossy(&bytes)),
        Err(_) => JS_UNDEFINED,
    }
}

unsafe extern "C" fn js_write(ctx: *mut JSContext, _this: JSValue, argc: i32, argv: *mut JSValue) -> JSValue {
    let (Some(path), Some(value)) = (
        arg_string(ctx, argc, argv, 0).as_deref().and_then(path_for),
        arg_string(ctx, argc, argv, 1),
    ) else {
        return JS_NewBool(ctx, false);
    };
    let _ = fs::create_dir_all(DIR);
    let tmp = format!("{path}.tmp");
    let ok = fs::write(&tmp, value.as_bytes()).is_ok() && {
        // sceIoRename does not replace an existing file.
        let _ = fs::remove_file(&path);
        fs::rename(&tmp, &path).is_ok()
    };
    JS_NewBool(ctx, ok)
}

unsafe extern "C" fn js_remove(ctx: *mut JSContext, _this: JSValue, argc: i32, argv: *mut JSValue) -> JSValue {
    let Some(path) = arg_string(ctx, argc, argv, 0).as_deref().and_then(path_for) else {
        return JS_NewBool(ctx, false);
    };
    JS_NewBool(ctx, fs::remove_file(&path).is_ok())
}

unsafe extern "C" fn js_keys(ctx: *mut JSContext, _this: JSValue, _argc: i32, _argv: *mut JSValue) -> JSValue {
    let mut out = String::new();
    if let Ok(dir) = fs::read_dir(DIR) {
        for entry in dir.flatten() {
            let name = entry.file_name();
            if let Some(key) = name.to_str().and_then(|n| n.strip_suffix(EXT)) {
                if !out.is_empty() {
                    out.push('\n');
                }
                out.push_str(key);
            }
        }
    }
    new_string(ctx, &out)
}

/// # Safety
///
/// `ctx` and `global` must be live values from the same QuickJS realm.
pub unsafe fn register(ctx: *mut JSContext, global: JSValue) {
    let obj = JS_NewObject(ctx);
    crate::ffi::add_fn(ctx, obj, b"read\0", js_read, 1);
    crate::ffi::add_fn(ctx, obj, b"write\0", js_write, 2);
    crate::ffi::add_fn(ctx, obj, b"remove\0", js_remove, 1);
    crate::ffi::add_fn(ctx, obj, b"keys\0", js_keys, 0);
    JS_SetPropertyStr(ctx, global, c"rsStore".as_ptr(), obj);
}
