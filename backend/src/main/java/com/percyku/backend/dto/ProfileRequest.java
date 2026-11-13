package com.percyku.backend.dto;

import com.percyku.backend.entity.User;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 會員中心的基本資料。email 不能修改，所以沒有這個欄位（多傳會被忽略）。tel、address 沒帶時視為清除。 */
public record ProfileRequest(
		@NotBlank(message = "name 屬性不得為空")
		@Size(max = User.NAME_MAX_LENGTH, message = "name 不得超過 " + User.NAME_MAX_LENGTH + " 個字")
		String name,
		@Pattern(regexp = "^$|^\\d{8," + User.TEL_MAX_LENGTH + "}$", message = "tel 需為 8–" + User.TEL_MAX_LENGTH + " 個數字")
		String tel,
		@Size(max = User.ADDRESS_MAX_LENGTH, message = "address 不得超過 " + User.ADDRESS_MAX_LENGTH + " 個字")
		String address) {

	public ProfileRequest {
		name = name == null ? null : name.strip();
		tel = tel == null ? "" : tel.strip();
		address = address == null ? "" : address.strip();
	}
}
