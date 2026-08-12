export function AimPage() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#F8FAFC",
        display: "flex",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1280,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h1
              style={{
                margin: 0,
                color: "#0F172A",
                fontSize: 20,
                fontFamily: "Inter",
                fontWeight: "600",
              }}
            >
              Mục tiêu & Tiến độ
            </h1>
            <div style={{ width: 1, height: 16, background: "#E2E8F0" }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#444651",
                fontSize: 16,
                fontFamily: "Inter",
              }}
            >
              <span>Computer Science Senior •</span>
              <div style={{ width: 10, height: 12, background: "#6E2C00" }} />
              <span>
                Chuỗi: <strong style={{ color: "#0F172A" }}>12 ngày</strong>
              </span>
            </div>
          </div>
          <button
            style={{
              padding: "8px 16px",
              background: "#1E3A8A",
              color: "white",
              border: "none",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 14,
              fontFamily: "Inter",
              fontWeight: "500",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                background: "white",
                borderRadius: 2,
              }}
            />
            Thêm mới
          </button>
        </div>
        <div
          style={{
            alignSelf: "stretch",
            padding: 20,
            background: "white",
            boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)",
            borderRadius: 4,
            outline: "1px #E2E8F0 solid",
            outlineOffset: "-1px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              alignSelf: "stretch",
              paddingBottom: 24,
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              display: "flex",
            }}
          >
            <div
              style={{
                alignSelf: "stretch",
                justifyContent: "space-between",
                alignItems: "center",
                display: "flex",
              }}
            >
              <div
                style={{
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  display: "flex",
                }}
              >
                <div
                  style={{
                    justifyContent: "center",
                    display: "flex",
                    flexDirection: "column",
                    color: "#0F172A",
                    fontSize: 20,
                    fontFamily: "Inter",
                    fontWeight: "400",
                    lineHeight: 28,
                    wordWrap: "break-word",
                  }}
                >
                  Quản lý Công việc chi tiết
                </div>
              </div>
              <div
                style={{
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  gap: 8.01,
                  display: "flex",
                }}
              >
                <div
                  style={{
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 6,
                    paddingBottom: 6,
                    background: "#F8F9FF",
                    borderRadius: 4,
                    outline: "1px #E2E8F0 solid",
                    outlineOffset: "-1px",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 4,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "center",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{ width: 12, height: 8, background: "#0F172A" }}
                    />
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#0F172A",
                      fontSize: 14,
                      fontFamily: "Inter",
                      fontWeight: "500",
                      lineHeight: 20,
                      wordWrap: "break-word",
                    }}
                  >
                    Lọc
                  </div>
                </div>
                <div
                  style={{
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 6,
                    paddingBottom: 6,
                    background: "#F8F9FF",
                    borderRadius: 4,
                    outline: "1px #E2E8F0 solid",
                    outlineOffset: "-1px",
                    justifyContent: "center",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#0F172A",
                      fontSize: 14,
                      fontFamily: "Inter",
                      fontWeight: "500",
                      lineHeight: 20,
                      wordWrap: "break-word",
                    }}
                  >
                    Xem tất cả
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              alignSelf: "stretch",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: 24,
              display: "flex",
            }}
          >
            <div
              style={{
                width: 769.34,
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: 24,
                display: "flex",
              }}
            >
              <div
                style={{
                  alignSelf: "stretch",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  gap: 8,
                  display: "flex",
                }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    paddingTop: 4,
                    paddingBottom: 4,
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 8,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{ width: 9, height: 5.55, background: "#444651" }}
                    />
                  </div>
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        justifyContent: "center",
                        display: "flex",
                        flexDirection: "column",
                        color: "#0F172A",
                        fontSize: 14,
                        fontFamily: "Inter",
                        fontWeight: "400",
                        textTransform: "uppercase",
                        lineHeight: 20,
                        letterSpacing: 0.7,
                        wordWrap: "break-word",
                      }}
                    >
                      HÔM NAY
                    </div>
                  </div>
                  <div
                    style={{
                      paddingLeft: 4,
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        justifyContent: "center",
                        display: "flex",
                        flexDirection: "column",
                        color: "#444651",
                        fontSize: 12,
                        fontFamily: "Inter",
                        fontWeight: "400",
                        lineHeight: 16,
                        wordWrap: "break-word",
                      }}
                    >
                      2
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    paddingLeft: 8,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "stretch",
                      paddingLeft: 16,
                      borderLeft: "1px #E2E8F0 solid",
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      gap: 4,
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        alignSelf: "stretch",
                        padding: 8,
                        borderRadius: 4,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 12,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          background: "white",
                          borderRadius: 4,
                          border: "1px #C5C5D3 solid",
                        }}
                      />
                      <div
                        style={{
                          flex: "1 1 0",
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            alignSelf: "stretch",
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#0F172A",
                            fontSize: 14,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            lineHeight: 20,
                            wordWrap: "break-word",
                          }}
                        >
                          Hoàn thiện bài tập Cấu trúc dữ liệu
                        </div>
                      </div>
                      <div
                        style={{
                          paddingLeft: 6,
                          paddingRight: 6,
                          paddingTop: 2,
                          paddingBottom: 2,
                          background: "rgba(186, 26, 26, 0.10)",
                          borderRadius: 4,
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#BA1A1A",
                            fontSize: 10,
                            fontFamily: "Inter",
                            fontWeight: "700",
                            textTransform: "uppercase",
                            lineHeight: 15,
                            wordWrap: "break-word",
                          }}
                        >
                          HIGH
                        </div>
                      </div>
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#BA1A1A",
                            fontSize: 11,
                            fontFamily: "Inter",
                            fontWeight: "500",
                            lineHeight: 16.5,
                            wordWrap: "break-word",
                          }}
                        >
                          14:00
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        alignSelf: "stretch",
                        padding: 8,
                        borderRadius: 4,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 12,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          background: "white",
                          borderRadius: 4,
                          border: "1px #C5C5D3 solid",
                        }}
                      />
                      <div
                        style={{
                          flex: "1 1 0",
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            alignSelf: "stretch",
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#0F172A",
                            fontSize: 14,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            lineHeight: 20,
                            wordWrap: "break-word",
                          }}
                        >
                          Review Code Project Cuối Kì
                        </div>
                      </div>
                      <div
                        style={{
                          paddingLeft: 6,
                          paddingRight: 6,
                          paddingTop: 2,
                          paddingBottom: 2,
                          background: "rgba(16, 185, 129, 0.10)",
                          borderRadius: 4,
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#10B981",
                            fontSize: 10,
                            fontFamily: "Inter",
                            fontWeight: "700",
                            textTransform: "uppercase",
                            lineHeight: 15,
                            wordWrap: "break-word",
                          }}
                        >
                          MEDIUM
                        </div>
                      </div>
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#444651",
                            fontSize: 11,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            lineHeight: 16.5,
                            wordWrap: "break-word",
                          }}
                        >
                          20:00
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        paddingTop: 8,
                        paddingBottom: 8,
                        paddingLeft: 8,
                        paddingRight: 641.23,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 8,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "center",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: 10.5,
                            height: 10.5,
                            background: "#444651",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          justifyContent: "center",
                          display: "flex",
                          flexDirection: "column",
                          color: "#444651",
                          fontSize: 14,
                          fontFamily: "Inter",
                          fontWeight: "400",
                          lineHeight: 20,
                          wordWrap: "break-word",
                        }}
                      >
                        Thêm việc
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  gap: 8,
                  display: "flex",
                }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    paddingTop: 4,
                    paddingBottom: 4,
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 8,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{ width: 9, height: 5.55, background: "#444651" }}
                    />
                  </div>
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        justifyContent: "center",
                        display: "flex",
                        flexDirection: "column",
                        color: "#0F172A",
                        fontSize: 14,
                        fontFamily: "Inter",
                        fontWeight: "400",
                        textTransform: "uppercase",
                        lineHeight: 20,
                        letterSpacing: 0.7,
                        wordWrap: "break-word",
                      }}
                    >
                      SẮP TỚI
                    </div>
                  </div>
                  <div
                    style={{
                      paddingLeft: 4,
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        justifyContent: "center",
                        display: "flex",
                        flexDirection: "column",
                        color: "#444651",
                        fontSize: 12,
                        fontFamily: "Inter",
                        fontWeight: "400",
                        lineHeight: 16,
                        wordWrap: "break-word",
                      }}
                    >
                      2
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    paddingLeft: 8,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "stretch",
                      paddingLeft: 16,
                      borderLeft: "1px #E2E8F0 solid",
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      gap: 4,
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        alignSelf: "stretch",
                        padding: 8,
                        borderRadius: 4,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 12,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          background: "white",
                          borderRadius: 4,
                          border: "1px #C5C5D3 solid",
                        }}
                      />
                      <div
                        style={{
                          flex: "1 1 0",
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            alignSelf: "stretch",
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#0F172A",
                            fontSize: 14,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            lineHeight: 20,
                            wordWrap: "break-word",
                          }}
                        >
                          Đọc chương 4 - HĐH
                        </div>
                      </div>
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#444651",
                            fontSize: 11,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            lineHeight: 16.5,
                            wordWrap: "break-word",
                          }}
                        >
                          Ngày mai
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        alignSelf: "stretch",
                        padding: 8,
                        borderRadius: 4,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 12,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          background: "white",
                          borderRadius: 4,
                          border: "1px #C5C5D3 solid",
                        }}
                      />
                      <div
                        style={{
                          flex: "1 1 0",
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            alignSelf: "stretch",
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#0F172A",
                            fontSize: 14,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            lineHeight: 20,
                            wordWrap: "break-word",
                          }}
                        >
                          Tìm hiểu Next.js App Router
                        </div>
                      </div>
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#444651",
                            fontSize: 11,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            lineHeight: 16.5,
                            wordWrap: "break-word",
                          }}
                        >
                          Thứ 6
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        paddingTop: 8,
                        paddingBottom: 8,
                        paddingLeft: 8,
                        paddingRight: 641.23,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 8,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "center",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: 10.5,
                            height: 10.5,
                            background: "#444651",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          justifyContent: "center",
                          display: "flex",
                          flexDirection: "column",
                          color: "#444651",
                          fontSize: 14,
                          fontFamily: "Inter",
                          fontWeight: "400",
                          lineHeight: 20,
                          wordWrap: "break-word",
                        }}
                      >
                        Thêm việc
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  gap: 8,
                  display: "flex",
                }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    paddingTop: 4,
                    paddingBottom: 4,
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 8,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{ width: 9, height: 5.55, background: "#444651" }}
                    />
                  </div>
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        justifyContent: "center",
                        display: "flex",
                        flexDirection: "column",
                        color: "#444651",
                        fontSize: 14,
                        fontFamily: "Inter",
                        fontWeight: "400",
                        textTransform: "uppercase",
                        lineHeight: 20,
                        letterSpacing: 0.7,
                        wordWrap: "break-word",
                      }}
                    >
                      ĐÃ HOÀN THÀNH
                    </div>
                  </div>
                  <div
                    style={{
                      paddingLeft: 4,
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        justifyContent: "center",
                        display: "flex",
                        flexDirection: "column",
                        color: "#444651",
                        fontSize: 12,
                        fontFamily: "Inter",
                        fontWeight: "400",
                        lineHeight: 16,
                        wordWrap: "break-word",
                      }}
                    >
                      1
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    paddingLeft: 8,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "stretch",
                      paddingLeft: 16,
                      opacity: 0.6,
                      borderLeft: "1px #E2E8F0 solid",
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        alignSelf: "stretch",
                        paddingTop: 8,
                        paddingBottom: 8,
                        paddingLeft: 7,
                        paddingRight: 8,
                        borderRadius: 4,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 11,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          background: "#1E3A8A",
                          overflow: "hidden",
                          borderRadius: 4,
                          outline: "1px rgba(0, 0, 0, 0) solid",
                          outlineOffset: "-1px",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: 8.99,
                              height: 7,
                              left: 3.51,
                              top: 4.5,
                              position: "absolute",
                              background: "white",
                            }}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          flex: "1 1 0",
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            alignSelf: "stretch",
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#0F172A",
                            fontSize: 14,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            textDecoration: "line-through",
                            lineHeight: 20,
                            wordWrap: "break-word",
                          }}
                        >
                          Họp nhóm đồ án
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                width: 396.66,
                alignSelf: "stretch",
                padding: 16,
                background: "#EFF4FF",
                borderRadius: 8,
                outline: "1px #E2E8F0 solid",
                outlineOffset: "-1px",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: 8,
                display: "flex",
              }}
            >
              <div
                style={{
                  alignSelf: "stretch",
                  justifyContent: "space-between",
                  alignItems: "center",
                  display: "flex",
                }}
              >
                <div
                  style={{
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#0F172A",
                      fontSize: 14,
                      fontFamily: "Inter",
                      fontWeight: "700",
                      lineHeight: 20,
                      wordWrap: "break-word",
                    }}
                  >
                    Tháng 11, 2023
                  </div>
                </div>
                <div
                  style={{
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    gap: 4,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      paddingTop: 4,
                      paddingBottom: 10,
                      paddingLeft: 4,
                      paddingRight: 4,
                      borderRadius: 4,
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        justifyContent: "center",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: 5.55,
                          height: 9,
                          background: "#334155",
                        }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      paddingTop: 4,
                      paddingBottom: 10,
                      paddingLeft: 4,
                      paddingRight: 4,
                      borderRadius: 4,
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        justifyContent: "center",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: 5.55,
                          height: 9,
                          background: "#334155",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  paddingTop: 8,
                  justifyContent: "center",
                  alignItems: "flex-start",
                  gap: 4,
                  display: "flex",
                }}
              >
                <div
                  style={{
                    width: 48.38,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 10,
                      fontFamily: "Inter",
                      fontWeight: "700",
                      lineHeight: 15,
                      wordWrap: "break-word",
                    }}
                  >
                    T2
                  </div>
                </div>
                <div
                  style={{
                    width: 48.38,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 10,
                      fontFamily: "Inter",
                      fontWeight: "700",
                      lineHeight: 15,
                      wordWrap: "break-word",
                    }}
                  >
                    T3
                  </div>
                </div>
                <div
                  style={{
                    width: 48.38,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 10,
                      fontFamily: "Inter",
                      fontWeight: "700",
                      lineHeight: 15,
                      wordWrap: "break-word",
                    }}
                  >
                    T4
                  </div>
                </div>
                <div
                  style={{
                    width: 48.39,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 10,
                      fontFamily: "Inter",
                      fontWeight: "700",
                      lineHeight: 15,
                      wordWrap: "break-word",
                    }}
                  >
                    T5
                  </div>
                </div>
                <div
                  style={{
                    width: 48.38,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 10,
                      fontFamily: "Inter",
                      fontWeight: "700",
                      lineHeight: 15,
                      wordWrap: "break-word",
                    }}
                  >
                    T6
                  </div>
                </div>
                <div
                  style={{
                    width: 48.38,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 10,
                      fontFamily: "Inter",
                      fontWeight: "700",
                      lineHeight: 15,
                      wordWrap: "break-word",
                    }}
                  >
                    T7
                  </div>
                </div>
                <div
                  style={{
                    width: 48.38,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 10,
                      fontFamily: "Inter",
                      fontWeight: "700",
                      lineHeight: 15,
                      wordWrap: "break-word",
                    }}
                  >
                    CN
                  </div>
                </div>
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  paddingBottom: 16,
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  display: "flex",
                }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    opacity: 0.4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    30
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    opacity: 0.4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    31
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    1
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    2
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    3
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    4
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    5
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    6
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    7
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    8
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    9
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    10
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    11
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    12
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    background: "#1E3A8A",
                    boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)",
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "white",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "700",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    13
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: 10.72,
                      height: 8.85,
                      background: "#334155",
                    }}
                  />
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    16
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    18
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    19
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    20
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    21
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    22
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    23
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    24
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    25
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    26
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    position: "relative",
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    14
                  </div>
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      left: 22.19,
                      top: 20,
                      position: "absolute",
                      background: "#BA1A1A",
                      borderRadius: 12,
                    }}
                  />
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 6,
                    position: "relative",
                    borderRadius: 4,
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 16,
                      wordWrap: "break-word",
                    }}
                  >
                    17
                  </div>
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      left: 22.19,
                      top: 20,
                      position: "absolute",
                      background: "#10B981",
                      borderRadius: 12,
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  paddingTop: 16,
                  borderTop: "1px #E2E8F0 solid",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  gap: 12,
                  display: "flex",
                }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "stretch",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 10,
                      fontFamily: "Inter",
                      fontWeight: "700",
                      textTransform: "uppercase",
                      lineHeight: 15,
                      letterSpacing: 1,
                      wordWrap: "break-word",
                    }}
                  >
                    SẮP TỚI
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    gap: 12,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "stretch",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      gap: 8,
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 12,
                        paddingTop: 6,
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          background: "#BA1A1A",
                          borderRadius: 12,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          alignSelf: "stretch",
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#0F172A",
                            fontSize: 12,
                            fontFamily: "Inter",
                            fontWeight: "600",
                            lineHeight: 16,
                            wordWrap: "break-word",
                          }}
                        >
                          Bài tập Cấu trúc dữ liệu
                        </div>
                      </div>
                      <div
                        style={{
                          alignSelf: "stretch",
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#444651",
                            fontSize: 10,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            lineHeight: 15,
                            wordWrap: "break-word",
                          }}
                        >
                          Hôm nay, 14:00
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      alignSelf: "stretch",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      gap: 8,
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 12,
                        paddingTop: 6,
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          background: "#10B981",
                          borderRadius: 12,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          alignSelf: "stretch",
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#0F172A",
                            fontSize: 12,
                            fontFamily: "Inter",
                            fontWeight: "600",
                            lineHeight: 16,
                            wordWrap: "break-word",
                          }}
                        >
                          Next.js App Router
                        </div>
                      </div>
                      <div
                        style={{
                          alignSelf: "stretch",
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#444651",
                            fontSize: 10,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            lineHeight: 15,
                            wordWrap: "break-word",
                          }}
                        >
                          Thứ 6, 15:00
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          alignSelf: "stretch",
          paddingTop: 24,
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          display: "flex",
        }}
      >
        <div
          style={{
            alignSelf: "stretch",
            padding: 20,
            background: "white",
            boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)",
            borderRadius: 8,
            outline: "1px #E2E8F0 solid",
            outlineOffset: "-1px",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            display: "flex",
          }}
        >
          <div
            style={{
              alignSelf: "stretch",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: 24,
              display: "flex",
            }}
          >
            <div
              style={{
                alignSelf: "stretch",
                justifyContent: "space-between",
                alignItems: "center",
                display: "flex",
              }}
            >
              <div
                style={{
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  gap: 4,
                  display: "flex",
                }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#0F172A",
                      fontSize: 20,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 28,
                      wordWrap: "break-word",
                    }}
                  >
                    Lộ trình &amp; Mục tiêu
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#444651",
                      fontSize: 14,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 20,
                      wordWrap: "break-word",
                    }}
                  >
                    Theo dõi và tối ưu hóa hành trình phát triển bản thân
                  </div>
                </div>
              </div>
              <div
                style={{
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 8,
                  display: "flex",
                }}
              >
                <div
                  style={{
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 6,
                    paddingBottom: 6,
                    background: "rgba(30, 58, 138, 0.05)",
                    borderRadius: 4,
                    outline: "1px rgba(30, 58, 138, 0.20) solid",
                    outlineOffset: "-1px",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 6,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "center",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        width: 16.5,
                        height: 16.5,
                        background: "#1E3A8A",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#1E3A8A",
                      fontSize: 14,
                      fontFamily: "Inter",
                      fontWeight: "500",
                      lineHeight: 20,
                      wordWrap: "break-word",
                    }}
                  >
                    Gợi ý lộ trình AI
                  </div>
                </div>
                <div
                  style={{
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 6,
                    paddingBottom: 6,
                    background: "#1E3A8A",
                    boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)",
                    borderRadius: 4,
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 6,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "center",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{ width: 10.5, height: 10.5, background: "white" }}
                    />
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "white",
                      fontSize: 14,
                      fontFamily: "Inter",
                      fontWeight: "500",
                      lineHeight: 20,
                      wordWrap: "break-word",
                    }}
                  >
                    Tạo lộ trình mới
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                display: "flex",
              }}
            >
              <div
                style={{
                  alignSelf: "stretch",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  gap: 16,
                  display: "flex",
                }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    padding: 16,
                    background: "#EFF4FF",
                    borderRadius: 8,
                    outline: "1px #E2E8F0 solid",
                    outlineOffset: "-1px",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    gap: 16,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "stretch",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 12,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          background: "#1E3A8A",
                          borderRadius: 4,
                          justifyContent: "center",
                          alignItems: "center",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            alignItems: "flex-start",
                            display: "flex",
                          }}
                        >
                          <div
                            style={{
                              width: 20.05,
                              height: 20.07,
                              background: "white",
                            }}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            alignSelf: "stretch",
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            alignItems: "flex-start",
                            display: "flex",
                          }}
                        >
                          <div
                            style={{
                              justifyContent: "center",
                              display: "flex",
                              flexDirection: "column",
                              color: "#0F172A",
                              fontSize: 16,
                              fontFamily: "Inter",
                              fontWeight: "700",
                              lineHeight: 24,
                              wordWrap: "break-word",
                            }}
                          >
                            Chinh phục IELTS 7.5
                          </div>
                        </div>
                        <div
                          style={{
                            alignSelf: "stretch",
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            alignItems: "flex-start",
                            display: "flex",
                          }}
                        >
                          <div
                            style={{
                              justifyContent: "center",
                              display: "flex",
                              flexDirection: "column",
                              color: "#444651",
                              fontSize: 10,
                              fontFamily: "Inter",
                              fontWeight: "700",
                              textTransform: "uppercase",
                              lineHeight: 15,
                              letterSpacing: 0.5,
                              wordWrap: "break-word",
                            }}
                          >
                            MỤC TIÊU HIỆN TẠI
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        paddingLeft: 8,
                        paddingRight: 8,
                        paddingTop: 4,
                        paddingBottom: 4,
                        background: "rgba(30, 58, 138, 0.10)",
                        borderRadius: 4,
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          justifyContent: "center",
                          display: "flex",
                          flexDirection: "column",
                          color: "#1E3A8A",
                          fontSize: 12,
                          fontFamily: "Inter",
                          fontWeight: "700",
                          lineHeight: 16,
                          wordWrap: "break-word",
                        }}
                      >
                        65% Hoàn thành
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      alignSelf: "stretch",
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      gap: 16,
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        alignSelf: "stretch",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        gap: 6,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          alignSelf: "stretch",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            alignSelf: "stretch",
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            alignItems: "flex-start",
                            display: "flex",
                          }}
                        >
                          <div
                            style={{
                              justifyContent: "center",
                              display: "flex",
                              flexDirection: "column",
                              color: "#444651",
                              fontSize: 10,
                              fontFamily: "Inter",
                              fontWeight: "700",
                              lineHeight: 15,
                              wordWrap: "break-word",
                            }}
                          >
                            TIẾN ĐỘ TỔNG THỂ
                          </div>
                        </div>
                        <div
                          style={{
                            alignSelf: "stretch",
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            alignItems: "flex-start",
                            display: "flex",
                          }}
                        >
                          <div
                            style={{
                              justifyContent: "center",
                              display: "flex",
                              flexDirection: "column",
                              color: "#0F172A",
                              fontSize: 10,
                              fontFamily: "Inter",
                              fontWeight: "700",
                              lineHeight: 15,
                              wordWrap: "break-word",
                            }}
                          >
                            Dự kiến: 20/01/2024
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          alignSelf: "stretch",
                          height: 8,
                          position: "relative",
                          background: "#D3E4FE",
                          overflow: "hidden",
                          borderRadius: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 488.36,
                            height: 8,
                            left: 0,
                            top: 0,
                            position: "absolute",
                            background: "#10B981",
                          }}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        alignSelf: "stretch",
                        padding: 12,
                        background: "white",
                        borderRadius: 4,
                        outline: "1px #E2E8F0 solid",
                        outlineOffset: "-1px",
                        justifyContent: "space-between",
                        alignItems: "center",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          justifyContent: "flex-start",
                          alignItems: "center",
                          gap: 12,
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            background: "rgba(16, 185, 129, 0.10)",
                            borderRadius: 12,
                            justifyContent: "center",
                            alignItems: "center",
                            display: "flex",
                          }}
                        >
                          <div
                            style={{
                              flexDirection: "column",
                              justifyContent: "flex-start",
                              alignItems: "flex-start",
                              display: "flex",
                            }}
                          >
                            <div
                              style={{
                                width: 11.25,
                                height: 12.75,
                                background: "#10B981",
                              }}
                            />
                          </div>
                        </div>
                        <div
                          style={{
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            alignItems: "flex-start",
                            display: "flex",
                          }}
                        >
                          <div
                            style={{
                              alignSelf: "stretch",
                              flexDirection: "column",
                              justifyContent: "flex-start",
                              alignItems: "flex-start",
                              display: "flex",
                            }}
                          >
                            <div
                              style={{
                                justifyContent: "center",
                                display: "flex",
                                flexDirection: "column",
                                color: "#0F172A",
                                fontSize: 12,
                                fontFamily: "Inter",
                                fontWeight: "700",
                                lineHeight: 16,
                                wordWrap: "break-word",
                              }}
                            >
                              Cột mốc tiếp theo
                            </div>
                          </div>
                          <div
                            style={{
                              alignSelf: "stretch",
                              flexDirection: "column",
                              justifyContent: "flex-start",
                              alignItems: "flex-start",
                              display: "flex",
                            }}
                          >
                            <div
                              style={{
                                justifyContent: "center",
                                display: "flex",
                                flexDirection: "column",
                                color: "#444651",
                                fontSize: 11,
                                fontFamily: "Inter",
                                fontWeight: "400",
                                lineHeight: 16.5,
                                wordWrap: "break-word",
                              }}
                            >
                              Phase 3: Advanced Writing &amp; Speaking
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            textAlign: "center",
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#1E3A8A",
                            fontSize: 12,
                            fontFamily: "Inter",
                            fontWeight: "700",
                            lineHeight: 16,
                            wordWrap: "break-word",
                          }}
                        >
                          Chi tiết
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    gap: 12,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: 253.77,
                      paddingTop: 12,
                      paddingBottom: 14,
                      paddingLeft: 12,
                      paddingRight: 12,
                      opacity: 0.6,
                      background: "#EFF4FF",
                      borderRadius: 4,
                      outline: "1px #E2E8F0 solid",
                      outlineOffset: "-1px",
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      gap: 4,
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        alignSelf: "stretch",
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 8,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: 13.33,
                            height: 13.33,
                            background: "#10B981",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#444651",
                            fontSize: 10,
                            fontFamily: "Inter",
                            fontWeight: "700",
                            textTransform: "uppercase",
                            lineHeight: 15,
                            wordWrap: "break-word",
                          }}
                        >
                          PHASE 1
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        alignSelf: "stretch",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          alignSelf: "stretch",
                          justifyContent: "center",
                          display: "flex",
                          flexDirection: "column",
                          color: "#0F172A",
                          fontSize: 12,
                          fontFamily: "Inter",
                          fontWeight: "600",
                          lineHeight: 16,
                          wordWrap: "break-word",
                        }}
                      >
                        Nền tảng &amp; Từ vựng
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 253.78,
                      padding: 12,
                      background: "rgba(30, 58, 138, 0.05)",
                      borderRadius: 4,
                      outline: "2px #1E3A8A solid",
                      outlineOffset: "-2px",
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      gap: 4,
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        alignSelf: "stretch",
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 8,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: 13.33,
                            height: 13.33,
                            background: "#1E3A8A",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#1E3A8A",
                            fontSize: 10,
                            fontFamily: "Inter",
                            fontWeight: "700",
                            textTransform: "uppercase",
                            lineHeight: 15,
                            wordWrap: "break-word",
                          }}
                        >
                          PHASE 2
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        alignSelf: "stretch",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          alignSelf: "stretch",
                          justifyContent: "center",
                          display: "flex",
                          flexDirection: "column",
                          color: "#0F172A",
                          fontSize: 12,
                          fontFamily: "Inter",
                          fontWeight: "600",
                          lineHeight: 16,
                          wordWrap: "break-word",
                        }}
                      >
                        Kỹ năng Nghe &amp; Đọc
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 253.78,
                      paddingTop: 12,
                      paddingBottom: 14,
                      paddingLeft: 12,
                      paddingRight: 12,
                      background: "#F8F9FF",
                      borderRadius: 4,
                      outline: "1px #E2E8F0 solid",
                      outlineOffset: "-1px",
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      gap: 4,
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        alignSelf: "stretch",
                        justifyContent: "flex-start",
                        alignItems: "center",
                        gap: 8,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: 10.67,
                            height: 14,
                            background: "#C5C5D3",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#444651",
                            fontSize: 10,
                            fontFamily: "Inter",
                            fontWeight: "700",
                            textTransform: "uppercase",
                            lineHeight: 15,
                            wordWrap: "break-word",
                          }}
                        >
                          PHASE 3
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        alignSelf: "stretch",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          alignSelf: "stretch",
                          justifyContent: "center",
                          display: "flex",
                          flexDirection: "column",
                          color: "#444651",
                          fontSize: 12,
                          fontFamily: "Inter",
                          fontWeight: "600",
                          lineHeight: 16,
                          wordWrap: "break-word",
                        }}
                      >
                        Luyện đề &amp; Phản xạ
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  padding: 20,
                  background: "rgba(30, 58, 138, 0.05)",
                  borderRadius: 8,
                  outline: "1px rgba(30, 58, 138, 0.20) solid",
                  outlineOffset: "-1px",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  gap: 16,
                  display: "flex",
                }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 7.99,
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        width: 19.01,
                        height: 20,
                        background: "#1E3A8A",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        justifyContent: "center",
                        display: "flex",
                        flexDirection: "column",
                        color: "#1E3A8A",
                        fontSize: 14,
                        fontFamily: "Inter",
                        fontWeight: "700",
                        lineHeight: 20,
                        wordWrap: "break-word",
                      }}
                    >
                      Trợ lý Lộ trình AI
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "stretch",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: "#334155",
                      fontSize: 12,
                      fontFamily: "Inter",
                      fontWeight: "400",
                      lineHeight: 19.5,
                      wordWrap: "break-word",
                    }}
                  >
                    Bạn muốn học gì tiếp theo? Hãy để AI thiết kế lộ trình cá
                    <br />
                    nhân hóa dựa trên mục tiêu của bạn.
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "stretch",
                    height: 136.5,
                    minHeight: 136,
                    paddingTop: 0.5,
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "stretch",
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      gap: 8,
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        alignSelf: "stretch",
                        height: 96,
                        padding: 12,
                        background: "white",
                        overflow: "hidden",
                        borderRadius: 4,
                        outline: "1px #E2E8F0 solid",
                        outlineOffset: "-1px",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          alignSelf: "stretch",
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "flex-start",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            alignSelf: "stretch",
                            justifyContent: "center",
                            display: "flex",
                            flexDirection: "column",
                            color: "#6B7280",
                            fontSize: 12,
                            fontFamily: "Inter",
                            fontWeight: "400",
                            lineHeight: 16,
                            wordWrap: "break-word",
                          }}
                        >
                          Ví dụ: Tôi muốn học lập trình Python trong 3 tháng để{" "}
                          <br />
                          làm Data Analysis...
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        alignSelf: "stretch",
                        paddingTop: 8,
                        paddingBottom: 8,
                        background: "#1E3A8A",
                        borderRadius: 4,
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 8,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          flexDirection: "column",
                          justifyContent: "flex-start",
                          alignItems: "center",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: 13.33,
                            height: 12,
                            background: "white",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          justifyContent: "center",
                          display: "flex",
                          flexDirection: "column",
                          color: "white",
                          fontSize: 12,
                          fontFamily: "Inter",
                          fontWeight: "700",
                          lineHeight: 16,
                          wordWrap: "break-word",
                        }}
                      >
                        Tạo lộ trình ngay
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
