      *================================================================*
      * CFREPORT.cbl - Financial Report Generator                      *
      * Arg 1: path to input file (R|name|balance|debit|credit lines)  *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CFREPORT.

       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER. LINUX.
       OBJECT-COMPUTER. LINUX.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT RPT-INPUT ASSIGN TO DYNAMIC WS-INFILE
               ORGANIZATION IS LINE SEQUENTIAL.

       DATA DIVISION.
       FILE SECTION.
       FD  RPT-INPUT.
       01  IN-RECORD           PIC X(300).

       WORKING-STORAGE SECTION.
       01  WS-INFILE           PIC X(200) VALUE SPACES.
       01  WS-EOF              PIC X VALUE 'N'.
       01  WS-REC-TYPE         PIC X VALUE SPACES.
       01  WS-ACC-NAME         PIC X(50) VALUE SPACES.
       01  WS-ACC-BAL-IN       PIC X(20) VALUE SPACES.
       01  WS-ACC-DEB-IN       PIC X(20) VALUE SPACES.
       01  WS-ACC-CRE-IN       PIC X(20) VALUE SPACES.
       01  WS-ACC-BALANCE      PIC 9(13)V99 VALUE ZEROS.
       01  WS-ACC-DEBIT        PIC 9(13)V99 VALUE ZEROS.
       01  WS-ACC-CREDIT       PIC 9(13)V99 VALUE ZEROS.
       01  WS-TOT-BALANCE      PIC 9(15)V99 VALUE ZEROS.
       01  WS-TOT-DEBIT        PIC 9(15)V99 VALUE ZEROS.
       01  WS-TOT-CREDIT       PIC 9(15)V99 VALUE ZEROS.
       01  WS-TOT-ACCOUNTS     PIC 9(7) VALUE ZEROS.
       01  WS-NET-FLOW         PIC S9(15)V99 VALUE ZEROS.
       01  WS-BAL-FMT          PIC ZZZ,ZZZ,ZZZ,ZZZ.99.
       01  WS-DEB-FMT          PIC ZZZ,ZZZ,ZZZ,ZZZ.99.
       01  WS-CRE-FMT          PIC ZZZ,ZZZ,ZZZ,ZZZ.99.
       01  WS-TOTBAL-FMT       PIC ZZZ,ZZZ,ZZZ,ZZZ,ZZZ.99.
       01  WS-TOTDEB-FMT       PIC ZZZ,ZZZ,ZZZ,ZZZ,ZZZ.99.
       01  WS-TOTCRE-FMT       PIC ZZZ,ZZZ,ZZZ,ZZZ,ZZZ.99.
       01  WS-TOTNET-FMT       PIC +ZZZ,ZZZ,ZZZ,ZZZ,ZZZ.99.
       01  WS-DATE-NUM         PIC 9(8).
       01  WS-DATE-STR         PIC X(10).
       01  WS-LINE-NO-D        PIC Z(6).

       PROCEDURE DIVISION.
       0000-MAIN.
           ACCEPT WS-INFILE FROM ARGUMENT-VALUE
           IF FUNCTION TRIM(WS-INFILE) = SPACES
               DISPLAY 'Usage: cfreport <input-file>'
               STOP RUN
           END-IF
           PERFORM 0100-HEADER
           OPEN INPUT RPT-INPUT
           MOVE 'N' TO WS-EOF
           PERFORM UNTIL WS-EOF = 'Y'
               READ RPT-INPUT INTO IN-RECORD
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END PERFORM 2000-PROCESS
               END-READ
           END-PERFORM
           CLOSE RPT-INPUT
           PERFORM 9000-FOOTER
           STOP RUN.

       0100-HEADER.
           MOVE FUNCTION CURRENT-DATE(1:8) TO WS-DATE-NUM
           STRING WS-DATE-NUM(1:4) '-'
                  WS-DATE-NUM(5:2) '-'
                  WS-DATE-NUM(7:2)
               DELIMITED SIZE INTO WS-DATE-STR
           END-STRING
           DISPLAY
               '======================================================'
           DISPLAY
               '   COMMUNITYFINANCE - LAPORAN KEUANGAN'
           DISPLAY
               '======================================================'
           DISPLAY 'Tanggal : ' WS-DATE-STR
           DISPLAY
               '------------------------------------------------------'
           DISPLAY
               ' No  Nama Rekening           Saldo          '
               'Keluar        Masuk'.

       2000-PROCESS.
           MOVE IN-RECORD(1:1) TO WS-REC-TYPE
           IF WS-REC-TYPE = 'R'
               UNSTRING IN-RECORD(3:) DELIMITED BY '|'
                   INTO WS-ACC-NAME WS-ACC-BAL-IN
                        WS-ACC-DEB-IN WS-ACC-CRE-IN
               END-UNSTRING
               MOVE FUNCTION NUMVAL(WS-ACC-BAL-IN) TO WS-ACC-BALANCE
               MOVE FUNCTION NUMVAL(WS-ACC-DEB-IN) TO WS-ACC-DEBIT
               MOVE FUNCTION NUMVAL(WS-ACC-CRE-IN) TO WS-ACC-CREDIT
               ADD 1 TO WS-TOT-ACCOUNTS
               ADD WS-ACC-BALANCE TO WS-TOT-BALANCE
               ADD WS-ACC-DEBIT   TO WS-TOT-DEBIT
               ADD WS-ACC-CREDIT  TO WS-TOT-CREDIT
               MOVE WS-ACC-BALANCE TO WS-BAL-FMT
               MOVE WS-ACC-DEBIT   TO WS-DEB-FMT
               MOVE WS-ACC-CREDIT  TO WS-CRE-FMT
               MOVE WS-TOT-ACCOUNTS TO WS-LINE-NO-D
               DISPLAY WS-LINE-NO-D ' ' WS-ACC-NAME(1:22) '  '
                       WS-BAL-FMT '  ' WS-DEB-FMT '  ' WS-CRE-FMT
           END-IF.

       9000-FOOTER.
           COMPUTE WS-NET-FLOW = WS-TOT-CREDIT - WS-TOT-DEBIT
           MOVE WS-TOT-BALANCE TO WS-TOTBAL-FMT
           MOVE WS-TOT-DEBIT   TO WS-TOTDEB-FMT
           MOVE WS-TOT-CREDIT  TO WS-TOTCRE-FMT
           MOVE WS-NET-FLOW    TO WS-TOTNET-FMT
           DISPLAY
               '======================================================'
           DISPLAY 'TOTAL REKENING : ' WS-TOT-ACCOUNTS
           DISPLAY 'Total Saldo    : IDR ' WS-TOTBAL-FMT
           DISPLAY 'Total Keluar   : IDR ' WS-TOTDEB-FMT
           DISPLAY 'Total Masuk    : IDR ' WS-TOTCRE-FMT
           DISPLAY 'Arus Kas Neto  : IDR ' WS-TOTNET-FMT
           DISPLAY
               '======================================================'
           DISPLAY
               '  CommunityFinance COBOL Report Engine v1.0'.
