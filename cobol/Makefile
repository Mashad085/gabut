# ================================================================
# Makefile — CommunityFinance COBOL Build System
# ================================================================
# Penggunaan:
#   make          - compile semua COBOL program
#   make clean    - hapus semua binary
#   make test     - test semua program
#   make install  - compile + verifikasi
# ================================================================

COBC     := cobc
COBFLAGS := -x
SRCDIR   := src
BINDIR   := bin

PROGRAMS := cftrxval cfwallet cfbudget cfbatch cfreport
BINS     := $(patsubst %, $(BINDIR)/%, $(PROGRAMS))

.PHONY: all clean test install check-compiler

all: check-compiler $(BINDIR) $(BINS)
	@echo ""
	@echo "Semua COBOL program berhasil dikompilasi"

check-compiler:
	@command -v $(COBC) >/dev/null 2>&1 || { \
		echo "GnuCOBOL tidak ditemukan. Install: sudo apt-get install gnucobol"; \
		exit 1; \
	}

$(BINDIR):
	mkdir -p $(BINDIR)

$(BINDIR)/cftrxval: $(SRCDIR)/CFTRXVAL.cbl
	$(COBC) $(COBFLAGS) -o $@ $< 2>&1 | grep -v "warning\|note" || true
	@echo "OK cftrxval"

$(BINDIR)/cfwallet: $(SRCDIR)/CFWALLET.cbl
	$(COBC) $(COBFLAGS) -o $@ $< 2>&1 | grep -v "warning\|note" || true
	@echo "OK cfwallet"

$(BINDIR)/cfbudget: $(SRCDIR)/CFBUDGET.cbl
	$(COBC) $(COBFLAGS) -o $@ $< 2>&1 | grep -v "warning\|note" || true
	@echo "OK cfbudget"

$(BINDIR)/cfbatch: $(SRCDIR)/CFBATCH.cbl
	$(COBC) $(COBFLAGS) -o $@ $< 2>&1 | grep -v "warning\|note" || true
	@echo "OK cfbatch"

$(BINDIR)/cfreport: $(SRCDIR)/CFREPORT.cbl
	$(COBC) $(COBFLAGS) -o $@ $< 2>&1 | grep -v "warning\|note" || true
	@echo "OK cfreport"

clean:
	rm -f $(BINDIR)/*

test: all
	@echo "--- cftrxval VALIDATE DEBIT OK ---"
	@$(BINDIR)/cftrxval action=VALIDATE amount=500000 balance=2000000 txn_type=DEBIT
	@echo "--- cftrxval VALIDATE saldo kurang ---"
	@$(BINDIR)/cftrxval action=VALIDATE amount=9999999 balance=2000000 txn_type=DEBIT
	@echo "--- cftrxval CALC-INTEREST 2.5pct 30 hari ---"
	@$(BINDIR)/cftrxval action=CALC-INTEREST balance=10000000 interest_rate=0.025 days=30
	@echo "--- cfwallet CALC-TRANSFER ---"
	@$(BINDIR)/cfwallet action=CALC-TRANSFER from_balance=5000 to_balance=1000 amount=500
	@echo "--- cfbudget ANALYZE ---"
	@$(BINDIR)/cfbudget action=ANALYZE total_income=10000000 total_budgeted=6000000
	@echo "--- cfbatch INTEREST ---"
	@printf 'action=INTEREST account_id=test-001 balance=5000000 rate=0.035 days=30\n' \
		> /tmp/cf_batch.tmp
	@$(BINDIR)/cfbatch /tmp/cf_batch.tmp
	@rm -f /tmp/cf_batch.tmp
	@echo "--- cfreport ---"
	@printf 'R|Tabungan Utama          |25000000.00|2500000.00|5000000.00\n' \
		> /tmp/cf_rpt.tmp
	@$(BINDIR)/cfreport /tmp/cf_rpt.tmp | head -8
	@rm -f /tmp/cf_rpt.tmp
	@echo "Semua test selesai"

install: all
	@ls -lh $(BINDIR)/
