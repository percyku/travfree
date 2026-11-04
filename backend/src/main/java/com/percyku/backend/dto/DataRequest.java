package com.percyku.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/** Hexschool 的寫入 API 都把內容包在 {"data": {...}} 裡。 */
public record DataRequest<T>(@NotNull(message = "data 屬性不得為空") @Valid T data) {
}
