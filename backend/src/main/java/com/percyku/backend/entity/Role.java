package com.percyku.backend.entity;

/** 帳號可以同時擁有多個角色：升級為管理者的會員同時有 USER 與 ADMIN。宣告順序就是回應中的順序。 */
public enum Role {
	USER,
	ADMIN
}
